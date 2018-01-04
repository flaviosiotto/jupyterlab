// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ArrayExt, IIterator, IterableOrArrayLike, each, toArray, ArrayIterator
} from '@phosphor/algorithm';

import {
  ISignal, Signal
} from '@phosphor/signaling';

import {
  ITaskModel
} from '@jupyterlab/tasks';

import {
  IObservableMap, ObservableMap, IObservableList,
  IObservableUndoableList, IModelDB
} from '@jupyterlab/observables';

import {
  TaskbookModel
} from './model';


/**
 * A task list object that supports undo/redo.
 */
export
class TaskList implements IObservableUndoableList<ITaskModel> {
  /**
   * Construct the task list.
   */
  constructor(modelDB: IModelDB, factory: TaskbookModel.IContentFactory) {
    this._factory = factory;
    this._taskOrder = modelDB.createList<string>('taskOrder');
    this._taskMap = new ObservableMap<ITaskModel>();

    this._taskOrder.changed.connect(this._onOrderChanged, this);
  }

  type: 'List';

  /**
   * A signal emitted when the task list has changed.
   */
  get changed(): ISignal<this, IObservableList.IChangedArgs<ITaskModel>> {
    return this._changed;
  }

  /**
   * Test whether the task list has been disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Test whether the list is empty.
   *
   * @returns `true` if the task list is empty, `false` otherwise.
   *
   * #### Notes
   * This is a read-only property.
   *
   * #### Complexity
   * Constant.
   *
   * #### Iterator Validity
   * No changes.
   */
  get isEmpty(): boolean {
    return this._taskOrder.length === 0;
  }

  /**
   * Get the length of the task list.
   *
   * @return The number of tasks in the task list.
   *
   * #### Notes
   * This is a read-only property.
   *
   * #### Complexity
   * Constant.
   *
   * #### Iterator Validity
   * No changes.
   */
  get length(): number {
    return this._taskOrder.length;
  }

  /**
   * Create an iterator over the cells in the cell list.
   *
   * @returns A new iterator starting at the front of the cell list.
   *
   * #### Complexity
   * Constant.
   *
   * #### Iterator Validity
   * No changes.
   */
  iter(): IIterator<ITaskModel> {
    let arr: ITaskModel[] = [];
    for (let id of toArray(this._taskOrder)) {
      arr.push(this._taskMap.get(id));
    }
    return new ArrayIterator<ITaskModel>(arr);
  }

  /**
   * Dispose of the resources held by the task list.
   */
  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    Signal.clearData(this);
    // Clean up the cell map and cell order objects.
    for (let task of this._taskMap.values()) {
      task.dispose();
    }
    this._taskMap.dispose();
    this._taskOrder.dispose();
  }

  /**
   * Get the task at the specified index.
   *
   * @param index - The positive integer index of interest.
   *
   * @returns The task at the specified index.
   *
   * #### Complexity
   * Constant.
   *
   * #### Iterator Validity
   * No changes.
   *
   * #### Undefined Behavior
   * An `index` which is non-integral or out of range.
   */
  get(index: number): ITaskModel {
    return this._taskMap.get(this._taskOrder.get(index)) as ITaskModel;
  }

  /**
   * Set the task at the specified index.
   *
   * @param index - The positive integer index of interest.
   *
   * @param task - The task to set at the specified index.
   *
   * #### Complexity
   * Constant.
   *
   * #### Iterator Validity
   * No changes.
   *
   * #### Undefined Behavior
   * An `index` which is non-integral or out of range.
   *
   * #### Notes
   * This should be considered to transfer ownership of the
   * cell to the `CellList`. As such, `cell.dispose()` should
   * not be called by other actors.
   */
  set(index: number, task: ITaskModel): void {
    // Set the internal data structures.
    this._taskMap.set(task.id, task);
    this._taskOrder.set(index, task.id);
  }

  /**
   * Add a task to the back of the task list.
   *
   * @param task - The task to add to the back of the task list.
   *
   * @returns The new length of the task list.
   *
   * #### Complexity
   * Constant.
   *
   * #### Iterator Validity
   * No changes.
   *
   * #### Notes
   * This should be considered to transfer ownership of the
   * task to the `TaskList`. As such, `cell.dispose()` should
   * not be called by other actors.
   */
  push(task: ITaskModel): number {
    // Set the internal data structures.
    this._taskMap.set(task.id, task);
    let num = this._taskOrder.push(task.id);
    return num;
  }

  /**
   * Insert a cell into the cell list at a specific index.
   *
   * @param index - The index at which to insert the cell.
   *
   * @param cell - The cell to set at the specified index.
   *
   * @returns The new length of the cell list.
   *
   * #### Complexity
   * Linear.
   *
   * #### Iterator Validity
   * No changes.
   *
   * #### Notes
   * The `index` will be clamped to the bounds of the cell list.
   *
   * #### Undefined Behavior
   * An `index` which is non-integral.
   *
   * #### Notes
   * This should be considered to transfer ownership of the
   * cell to the `CellList`. As such, `cell.dispose()` should
   * not be called by other actors.
   */
  insert(index: number, cell: ITaskModel): void {
    // Set the internal data structures.
    this._taskMap.set(cell.id, cell);
    this._taskOrder.insert(index, cell.id);
  }

  /**
   * Remove the first occurrence of a task from the task list.
   *
   * @param task - The task of interest.
   *
   * @returns The index of the removed task, or `-1` if the task
   *   is not contained in the task list.
   *
   * #### Complexity
   * Linear.
   *
   * #### Iterator Validity
   * Iterators pointing at the removed task and beyond are invalidated.
   */
  removeValue(task: ITaskModel): number {
    let index = ArrayExt.findFirstIndex(
      toArray(this._taskOrder), id => (this._taskMap.get(id) === task));
    this.remove(index);
    return index;
  }

  /**
   * Remove and return the task at a specific index.
   *
   * @param index - The index of the task of interest.
   *
   * @returns The task at the specified index, or `undefined` if the
   *   index is out of range.
   *
   * #### Complexity
   * Constant.
   *
   * #### Iterator Validity
   * Iterators pointing at the removed task and beyond are invalidated.
   *
   * #### Undefined Behavior
   * An `index` which is non-integral.
   */
  remove(index: number): ITaskModel {
    let id = this._taskOrder.get(index);
    this._taskOrder.remove(index);
    let task = this._taskMap.get(id);
    return task;
  }

  /**
   * Remove all tasks from the cell list.
   *
   * #### Complexity
   * Linear.
   *
   * #### Iterator Validity
   * All current iterators are invalidated.
   */
  clear(): void {
    this._taskOrder.clear();
  }

  /**
   * Move a task from one index to another.
   *
   * @parm fromIndex - The index of the element to move.
   *
   * @param toIndex - The index to move the element to.
   *
   * #### Complexity
   * Constant.
   *
   * #### Iterator Validity
   * Iterators pointing at the lesser of the `fromIndex` and the `toIndex`
   * and beyond are invalidated.
   *
   * #### Undefined Behavior
   * A `fromIndex` or a `toIndex` which is non-integral.
   */
  move(fromIndex: number, toIndex: number): void {
    this._taskOrder.move(fromIndex, toIndex);
  }

  /**
   * Push a set of tasks to the back of the task list.
   *
   * @param tasks - An iterable or array-like set of tasks to add.
   *
   * @returns The new length of the task list.
   *
   * #### Complexity
   * Linear.
   *
   * #### Iterator Validity
   * No changes.
   *
   * #### Notes
   * This should be considered to transfer ownership of the
   * cells to the `TaskList`. As such, `task.dispose()` should
   * not be called by other actors.
   */
  pushAll(tasks: IterableOrArrayLike<ITaskModel>): number {
    let newValues = toArray(tasks);
    each(newValues, task => {
      // Set the internal data structures.
      this._taskMap.set(task.id, task);
      this._taskOrder.push(task.id);
    });
    return this.length;
  }

  /**
   * Insert a set of items into the task list at the specified index.
   *
   * @param index - The index at which to insert the tasks.
   *
   * @param tasks - The tasks to insert at the specified index.
   *
   * @returns The new length of the task list.
   *
   * #### Complexity.
   * Linear.
   *
   * #### Iterator Validity
   * No changes.
   *
   * #### Notes
   * The `index` will be clamped to the bounds of the cell list.
   *
   * #### Undefined Behavior.
   * An `index` which is non-integral.
   *
   * #### Notes
   * This should be considered to transfer ownership of the
   * tasks to the `TaskList`. As such, `task.dispose()` should
   * not be called by other actors.
   */
  insertAll(index: number, tasks: IterableOrArrayLike<ITaskModel>): number {
    let newValues = toArray(tasks);
    each(newValues, task => {
      this._taskMap.set(task.id, task);
      this._taskOrder.beginCompoundOperation();
      this._taskOrder.insert(index++, task.id);
      this._taskOrder.endCompoundOperation();
    });
    return this.length;
  }

  /**
   * Remove a range of items from the task list.
   *
   * @param startIndex - The start index of the range to remove (inclusive).
   *
   * @param endIndex - The end index of the range to remove (exclusive).
   *
   * @returns The new length of the task list.
   *
   * #### Complexity
   * Linear.
   *
   * #### Iterator Validity
   * Iterators pointing to the first removed task and beyond are invalid.
   *
   * #### Undefined Behavior
   * A `startIndex` or `endIndex` which is non-integral.
   */
  removeRange(startIndex: number, endIndex: number): number {
    this._taskOrder.removeRange(startIndex, endIndex);
    return this.length;
  }

  /**
   * Whether the object can redo changes.
   */
  get canRedo(): boolean {
    return this._taskOrder.canRedo;
  }

  /**
   * Whether the object can undo changes.
   */
  get canUndo(): boolean {
    return this._taskOrder.canUndo;
  }

  /**
   * Begin a compound operation.
   *
   * @param isUndoAble - Whether the operation is undoable.
   *   The default is `true`.
   */
  beginCompoundOperation(isUndoAble?: boolean): void {
    this._taskOrder.beginCompoundOperation(isUndoAble);
  }

  /**
   * End a compound operation.
   */
  endCompoundOperation(): void {
    this._taskOrder.endCompoundOperation();
  }

  /**
   * Undo an operation.
   */
  undo(): void {
    this._taskOrder.undo();
  }

  /**
   * Redo an operation.
   */
  redo(): void {
    this._taskOrder.redo();
  }

  /**
   * Clear the change stack.
   */
  clearUndo(): void {
    // Dispose of cells not in the current
    // cell order.
    for (let key of this._taskMap.keys()) {
      if (ArrayExt.findFirstIndex(
         toArray(this._taskOrder), id => id === key) === -1) {
        let task = this._taskMap.get(key) as ITaskModel;
        task.dispose();
        this._taskMap.delete(key);
      }
    }
    this._taskOrder.clearUndo();
  }

  private _onOrderChanged(order: IObservableUndoableList<string>, change: IObservableList.IChangedArgs<string>): void {
    if (change.type === 'add' || change.type === 'set') {
      each(change.newValues, (id) => {
        if (!this._taskMap.has(id)) {
          let taskDB = this._factory.modelDB;
          let taskType = taskDB.createValue(id + '.type');
          let task: ITaskModel;
          switch (taskType.get()) {
            case 'Dataintegration':
              task = this._factory.createDataintegrationTask({ id: id});
              break;
            case 'Notebookcell':
              task = this._factory.createNotebookcellTask({ id: id});
              break;
          }
          this._taskMap.set(id, task);
        }
      });
    }
    let newValues: ITaskModel[] = [];
    let oldValues: ITaskModel[] = [];
    each(change.newValues, (id) => {
      newValues.push(this._taskMap.get(id));
    });
    each(change.oldValues, (id) => {
      oldValues.push(this._taskMap.get(id));
    });
    this._changed.emit({
      type: change.type,
      oldIndex: change.oldIndex,
      newIndex: change.newIndex,
      oldValues,
      newValues
    });
  }

  private _isDisposed: boolean = false;
  private _taskOrder: IObservableUndoableList<string> = null;
  private _taskMap: IObservableMap<ITaskModel> = null;
  private _changed = new Signal<this, IObservableList.IChangedArgs<ITaskModel>>(this);
  private _factory: TaskbookModel.IContentFactory = null;
}
