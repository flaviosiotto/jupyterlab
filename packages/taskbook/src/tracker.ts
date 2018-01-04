// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  IInstanceTracker, InstanceTracker
} from '@jupyterlab/apputils';

import {
  Task
} from '@jupyterlab/tasks';

import {
  Token
} from '@phosphor/coreutils';

import {
  ISignal, Signal
} from '@phosphor/signaling';

import {
  TaskbookPanel, Taskbook
} from './';


/**
 * An object that tracks taskbook widgets.
 */
export
interface ITaskbookTracker extends IInstanceTracker<TaskbookPanel> {
  /**
   * The currently focused task.
   *
   * #### Notes
   * If there is no task with the focus, then this value is `null`.
   */
  readonly activeTask: Task;

  /**
   * A signal emitted when the current active cell changes.
   *
   * #### Notes
   * If there is no cell with the focus, then `null` will be emitted.
   */
  readonly activeTaskChanged: ISignal<this, Task>;

  /**
   * A signal emitted when the selection state changes.
   */
  readonly selectionChanged: ISignal<this, void>;
}


/* tslint:disable */
/**
 * The taskbook tracker token.
 */
export
const ITaskbookTracker = new Token<ITaskbookTracker>('@jupyterlab/taskbook:ITaskbookTracker');
/* tslint:enable */


export
class TaskbookTracker extends InstanceTracker<TaskbookPanel> implements ITaskbookTracker {
  /**
   * The currently focused task.
   *
   * #### Notes
   * This is a read-only property. If there is no cell with the focus, then this
   * value is `null`.
   */
  get activeTask(): Task {
    let widget = this.currentWidget;
    if (!widget) {
      return null;
    }
    return widget.taskbook.activeTask || null;
  }

  /**
   * A signal emitted when the current active cell changes.
   *
   * #### Notes
   * If there is no cell with the focus, then `null` will be emitted.
   */
  get activeTaskChanged(): ISignal<this, Task> {
    return this._activeTaskChanged;
  }

  /**
   * A signal emitted when the selection state changes.
   */
  get selectionChanged(): ISignal<this, void> {
    return this._selectionChanged;
  }

  /**
   * Add a new taskbook panel to the tracker.
   *
   * @param panel - The taskbook panel being added.
   */
  add(panel: TaskbookPanel): Promise<void> {
    const promise = super.add(panel);
    panel.taskbook.activeTaskChanged.connect(this._onActiveTaskChanged, this);
    panel.taskbook.selectionChanged.connect(this._onSelectionChanged, this);
    return promise;
  }

  /**
   * Dispose of the resources held by the tracker.
   */
  dispose(): void {
    this._activeTask = null;
    super.dispose();
  }

  /**
   * Handle the current change event.
   */
  protected onCurrentChanged(widget: TaskbookPanel): void {
    // Store an internal reference to active cell to prevent false positives.
    let activeTask = this.activeTask;
    if (activeTask && activeTask === this._activeTask) {
      return;
    }
    this._activeTask = activeTask;

    if (!widget) {
      return;
    }

    // Since the taskbook has changed, immediately signal an active cell change
    this._activeTaskChanged.emit(widget.taskbook.activeTask || null);
  }

  private _onActiveTaskChanged(sender: Taskbook, cell: Task): void {
    // Check if the active cell change happened for the current taskbook.
    if (this.currentWidget && this.currentWidget.taskbook === sender) {
      this._activeTask = cell || null;
      this._activeTaskChanged.emit(this._activeTask);
    }
  }

  private _onSelectionChanged(sender: Taskbook): void {
    // Check if the selection change happened for the current taskbook.
    if (this.currentWidget && this.currentWidget.taskbook === sender) {
      this._selectionChanged.emit(void 0);
    }
  }

  private _activeTask: Task | null = null;
  private _activeTaskChanged = new Signal<this, Task>(this);
  private _selectionChanged = new Signal<this, void>(this);
}
