// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  each
} from '@phosphor/algorithm';

import {
  DocumentModel, DocumentRegistry
} from '@jupyterlab/docregistry';

import {
  ITaskModel, IDataintegrationTaskModel, INotebookcellTaskModel,
  DataintegrationTaskModel, NotebookcellTaskModel, TaskModel
} from '@jupyterlab/tasks';

import {
  nbformat, uuid
} from '@jupyterlab/coreutils';

import {
  tbformat
} from '@jupyterlab/taskbookutils';

import {
  IObservableJSON, IObservableUndoableList,
  IObservableList, IModelDB
} from '@jupyterlab/observables';

import {
  TaskList
} from './tasklist';


/**
 * The definition of a model object for a Taskbook widget.
 */
export
interface ITaskbookModel extends DocumentRegistry.IModel {
  /**
   * The list of tasks in the Taskbook.
   */
  readonly tasks: IObservableUndoableList<ITaskModel>;

  /**
   * The task model factory for the Taskbook.
   */
  readonly contentFactory: TaskbookModel.IContentFactory;

  /**
   * The major version number of the nbformat.
   */
  readonly nbformat: number;

  /**
   * The minor version number of the nbformat.
   */
  readonly nbformatMinor: number;

  /**
   * The metadata associated with the Taskbook.
   */
  readonly metadata: IObservableJSON;
}


/**
 * An implementation of a Taskbook Model.
 */
export
class TaskbookModel extends DocumentModel implements ITaskbookModel {
  /**
   * Construct a new Taskbook model.
   */
  constructor(options: TaskbookModel.IOptions = {}) {
    super(options.languagePreference, options.modelDB);
    let factory = (
      options.contentFactory || TaskbookModel.defaultContentFactory
    );
    this.contentFactory = factory.clone(this.modelDB.view('tasks'));
    this._tasks = new TaskList(this.modelDB, this.contentFactory);

    this._tasks.changed.connect(this._onTasksChanged, this);

    // Handle initial metadata.
    let metadata = this.modelDB.createMap('metadata');
    if (!metadata.has('language_info')) {
      let name = options.languagePreference || '';
      metadata.set('language_info', { name });
    }
    this._ensureMetadata();
    metadata.changed.connect(this.triggerContentChange, this);
  }

  /**
   * The task model factory for the Taskbook.
   */
  readonly contentFactory: TaskbookModel.IContentFactory;

  /**
   * The metadata associated with the Taskbook.
   */
  get metadata(): IObservableJSON {
    return this.modelDB.get('metadata') as IObservableJSON;
  }

  /**
   * Get the observable list of Taskbook tasks.
   */
  get tasks(): IObservableUndoableList<ITaskModel> {
    return this._tasks;
  }

  /**
   * The major version number of the nbformat.
   */
  get nbformat(): number {
    return this._nbformat;
  }

  /**
   * The minor version number of the nbformat.
   */
  get nbformatMinor(): number {
    return this._nbformatMinor;
  }

  /**
   * The default kernel name of the document.
   */
  get defaultKernelName(): string {
    let spec = this.metadata.get('kernelspec') as nbformat.IKernelspecMetadata;
    return spec ? spec.name : '';
  }

  /**
   * The default kernel language of the document.
   */
  get defaultKernelLanguage(): string {
    let info = this.metadata.get('language_info') as nbformat.ILanguageInfoMetadata;
    return info ? info.name : '';
  }

  /**
   * Dispose of the resources held by the model.
   */
  dispose(): void {
    // Do nothing if already disposed.
    if (this.tasks === null) {
      return;
    }
    let tasks = this.tasks;
    this._tasks = null;
    tasks.dispose();
    super.dispose();
  }

  /**
   * Serialize the model to a string.
   */
  toString(): string {
    console.log('TaskbookModel toString')
    return JSON.stringify(this.toJSON());
  }

  /**
   * Deserialize the model from a string.
   *
   * #### Notes
   * Should emit a [contentChanged] signal.
   */
  fromString(value: string): void {
    console.log('TaskbookModel fromString')
    this.fromJSON(JSON.parse(value));
  }

  /**
   * Serialize the model to JSON.
   */
  toJSON(): tbformat.ITaskbookContent {
    let tasks: tbformat.ITask[] = [];
    for (let i = 0; i < this.tasks.length; i++) {
      let task = this.tasks.get(i);
      tasks.push(task.toJSON());
    }

    let cells: nbformat.ICell[] = [];

    this._ensureMetadata();
    let metadata = Object.create(null) as tbformat.ITaskbookMetadata;
    for (let key of this.metadata.keys()) {
      metadata[key] = JSON.parse(JSON.stringify(this.metadata.get(key)));
    }
    return {
      metadata,
      nbformat_minor: this._nbformatMinor,
      nbformat: this._nbformat,
      cells,
      tasks
    };
  }

  /**
   * Deserialize the model from JSON.
   *
   * #### Notes
   * Should emit a [contentChanged] signal.
   */
  fromJSON(value: tbformat.ITaskbookContent): void {
    let tasks: ITaskModel[] = [];
    let factory = this.contentFactory;
    for (let task of value.tasks) {
      switch (task.task_type) {
      case 'Dataintegration':
        tasks.push(factory.createDataintegrationTask({ task }));
        break;
      case 'Notebookcell':
        tasks.push(factory.createNotebookcellTask({ task }));
        break;
      default:
        continue;
      }
    }
    this.tasks.beginCompoundOperation();
    this.tasks.clear();
    this.tasks.pushAll(tasks);
    this.tasks.endCompoundOperation();

    let oldValue = 0;
    let newValue = 0;
    this._nbformatMinor = nbformat.MINOR_VERSION;
    this._nbformat = nbformat.MAJOR_VERSION;

    if (value.nbformat !== this._nbformat) {
      oldValue = this._nbformat;
      this._nbformat = newValue = value.nbformat;
      this.triggerStateChange({ name: 'nbformat', oldValue, newValue });
    }
    if (value.nbformat_minor > this._nbformatMinor) {
      oldValue = this._nbformatMinor;
      this._nbformatMinor = newValue = value.nbformat_minor;
      this.triggerStateChange({ name: 'nbformatMinor', oldValue, newValue });
    }
    // Update the metadata.
    this.metadata.clear();
    let metadata = value.metadata;
    for (let key in metadata) {
      // orig_nbformat is not intended to be stored per spec.
      if (key === 'orig_nbformat') {
        continue;
      }
      this.metadata.set(key, metadata[key]);
    }
    this._ensureMetadata();
    this.dirty = true;
  }

  /**
   * Handle a change in the tasks list.
   */
  private _onTasksChanged(list: IObservableList<ITaskModel>, change: IObservableList.IChangedArgs<ITaskModel>): void {
    switch (change.type) {
    case 'add':
      each(change.newValues, task => {
        task.contentChanged.connect(this.triggerContentChange, this);
      });
      break;
    case 'remove':
      each(change.oldValues, task => {
      });
      break;
    case 'set':
      each(change.newValues, task => {
        task.contentChanged.connect(this.triggerContentChange, this);
      });
      each(change.oldValues, task => {
      });
      break;
    default:
      return;
    }
    let factory = this.contentFactory;
    // Add code cell if there are no cells remaining.
    if (!this.tasks.length) {
      // Add the cell in a new context to avoid triggering another
      // cell changed event during the handling of this signal.
      requestAnimationFrame(() => {
        if (!this.isDisposed && !this.tasks.length) {
          this.tasks.push(factory.createDataintegrationTask({}));
        }
      });
    }
    this.triggerContentChange();
  }

  /**
   * Make sure we have the required metadata fields.
   */
  private _ensureMetadata(): void {
    let metadata = this.metadata;
    if (!metadata.has('language_info')) {
      metadata.set('language_info', { name: '' });
    }
    if (!metadata.has('kernelspec')) {
      metadata.set('kernelspec', { name: '', display_name: '' });
    }
  }

  private _tasks: TaskList;
  private _nbformat = nbformat.MAJOR_VERSION;
  private _nbformatMinor = nbformat.MINOR_VERSION;
}


/**
 * The namespace for the `TaskbookModel` class statics.
 */
export
namespace TaskbookModel {
  /**
   * An options object for initializing a Taskbook model.
   */
  export
  interface IOptions {
    /**
     * The language preference for the model.
     */
    languagePreference?: string;

    /**
     * A factory for creating task models.
     *
     * The default is a shared factory instance.
     */
    contentFactory?: IContentFactory;

    /**
     * A modelDB for storing Taskbook data.
     */
    modelDB?: IModelDB;
  }

  /**
   * A factory for creating Taskbook model content.
   */
  export
  interface IContentFactory {
    /**
     * The factory for output area models.
     */
    readonly DataintegrationTaskContentFactory: DataintegrationTaskModel.IContentFactory;

    /**
     * The IModelDB in which to put data for the Taskbook model.
     */
    modelDB: IModelDB;

    /**
     * Create a new Dataintegration task.
     *
     * @param options - The options used to create the task.
     *
     * @returns A new code cell. If a source cell is provided, the
     *   new cell will be intialized with the data from the source.
     */
    createDataintegrationTask(options: DataintegrationTaskModel.IOptions): IDataintegrationTaskModel;

    /**
     * Create a new Notebookcell task.
     *
     * @param options - The options used to create the task.
     *
     * @returns A new markdown cell. If a source cell is provided, the
     *   new cell will be intialized with the data from the source.
     */
    createNotebookcellTask(options: TaskModel.IOptions): INotebookcellTaskModel;

    /**
     * Clone the content factory with a new IModelDB.
     */
    clone(modelDB: IModelDB): IContentFactory;
  }

  /**
   * The default implementation of an `IContentFactory`.
   */
  export
  class ContentFactory implements IContentFactory{
    /**
     * Create a new task model factory.
     */
    constructor(options: ContentFactory.IOptions) {
      this.DataintegrationTaskContentFactory = (options.DataintegrationTaskContentFactory ||
        DataintegrationTaskModel.defaultContentFactory
      );
      this.modelDB = options.modelDB;
    }

    /**
     * The factory for Dataintegration task content.
     */
    readonly DataintegrationTaskContentFactory: DataintegrationTaskModel.IContentFactory;

    /**
     * The IModelDB in which to put the Taskbook data.
     */
    readonly modelDB: IModelDB | undefined;

    /**
     * Create a new Dataintegration task.
     *
     * @param source - The data to use for the original source data.
     *
     * @returns A new Dataintegration task. If a source task is provided, the
     *   new task will be intialized with the data from the source.
     *   If the contentFactory is not provided, the instance
     *   `DataintegrationTaskContentFactory` will be used.
     */
    createDataintegrationTask(options: DataintegrationTaskModel.IOptions): IDataintegrationTaskModel {
      if (options.contentFactory) {
        options.contentFactory = this.DataintegrationTaskContentFactory;
      }
      if (this.modelDB) {
        if (!options.id) {
          options.id = uuid();
        }
        options.modelDB = this.modelDB.view(options.id);
      }
      return new DataintegrationTaskModel(options);
    }

    /**
     * Create a new Notebookcell task.
     *
     * @param source - The data to use for the original source data.
     *
     * @returns A new Notebookcell task. If a source task is provided, the
     *   new task will be intialized with the data from the source.
     */
    createNotebookcellTask(options: TaskModel.IOptions): INotebookcellTaskModel {
      if (this.modelDB) {
        if (!options.id) {
          options.id = uuid();
        }
        options.modelDB = this.modelDB.view(options.id);
      }
      return new NotebookcellTaskModel(options);
    }

    /**
     * Clone the content factory with a new IModelDB.
     */
    clone(modelDB: IModelDB): ContentFactory {
      return new ContentFactory({
        modelDB: modelDB,
        DataintegrationTaskContentFactory: this.DataintegrationTaskContentFactory
      });
    }
  }

  /**
   * A namespace for the Taskbook model content factory.
   */
  export
  namespace ContentFactory {
    /**
     * The options used to initialize a `ContentFactory`.
     */
    export
    interface IOptions {
      /**
       * The factory for Dataintegration task model content.
       */
      DataintegrationTaskContentFactory?: DataintegrationTaskModel.IContentFactory;

      /**
       * The modelDB in which to place new content.
       */
      modelDB?: IModelDB;
    }
  }

  /**
   * The default `ContentFactory` instance.
   */
  export
  const defaultContentFactory = new ContentFactory({});
}
