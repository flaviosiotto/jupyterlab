/*-----------------------------------------------------------------------------
| Copyright (c) Jupyter Development Team.
| Distributed under the terms of the Modified BSD License.
|----------------------------------------------------------------------------*/

import {
  JSONExt, JSONValue
} from '@phosphor/coreutils';

import {
  ISignal, Signal
} from '@phosphor/signaling';

import {
  CodeEditor
} from '@jupyterlab/codeeditor';

import {
  IChangedArgs, nbformat, uuid
} from '@jupyterlab/coreutils';

import {
  tbformat
} from '@jupyterlab/taskbookutils';

import {
  IObservableJSON, IModelDB, IObservableValue, ObservableValue
} from '@jupyterlab/observables';

import {
  IOutputAreaModel, OutputAreaModel
} from '@jupyterlab/outputarea';


/**
 * The definition of a model object for a Task.
 */
export
interface ITaskModel extends CodeEditor.IModel {
  /**
   * The type of the Task.
   */
  readonly type: tbformat.TaskType;

  /**
   * A unique identifier for the Task.
   */
  readonly id: string;

  /**
   * A signal emitted when the content of the model changes.
   */
  readonly contentChanged: ISignal<ITaskModel, void>;

  /**
   * A signal emitted when a model state changes.
   */
  readonly stateChanged: ISignal<ITaskModel, IChangedArgs<any>>;

  /**
   * Whether the Task is trusted.
   */
  trusted: boolean;

  /**
   * The metadata associated with the Task.
   */
  readonly metadata: IObservableJSON;

  /**
   * Serialize the model to JSON.
   */
  toJSON(): tbformat.ITask;
}


/**
 * The definition of a code Task.
 */
export
interface IDataintegrationTaskModel extends ITaskModel {
  /**
   * The type of the Task.
   *
   * #### Notes
   * This is a read-only property.
   */
  type: 'Dataintegration';

  /**
   * The code Task's prompt number. Will be null if the Task has not been run.
   */
  executionCount: nbformat.ExecutionCount;

  /**
   * The Task outputs.
   */
  outputs: IOutputAreaModel;
}


/**
 * The definition of a markdown Task.
 */
export
interface INotebookcellTaskModel extends ITaskModel {
  /**
   * The type of the Task.
   */
  type: 'Notebookcell';
 }



/**
 * An implementation of the Task model.
 */
export
class TaskModel extends CodeEditor.Model implements ITaskModel {
  /**
   * Construct a Task model from optional Task content.
   */
  constructor(options: TaskModel.IOptions) {
    super({modelDB: options.modelDB});

    this.id = options.id || uuid();

    this.value.changed.connect(this.onGenericChange, this);

    let TaskType = this.modelDB.createValue('type');
    TaskType.set(this.type);

    let observableMetadata = this.modelDB.createMap('metadata');
    observableMetadata.changed.connect(this.onGenericChange, this);

    let task = options.task;
    let trusted = this.modelDB.createValue('trusted');
    trusted.changed.connect(this.onTrustedChanged, this);

    if (!task) {
      trusted.set(false);
      return;
    }
    trusted.set(!!task.metadata['trusted']);
    delete task.metadata['trusted'];

    if (Array.isArray(task.source)) {
      this.value.text = (task.source as string[]).join('');
    } else {
      this.value.text = task.source as string;
    }
    let metadata = JSONExt.deepCopy(task.metadata);

    for (let key in metadata) {
      observableMetadata.set(key, metadata[key]);
    }
  }

  /**
   * The type of Task.
   */
  readonly type: tbformat.TaskType;

  /**
   * A signal emitted when the state of the model changes.
   */
  readonly contentChanged = new Signal<this, void>(this);

  /**
   * A signal emitted when a model state changes.
   */
  readonly stateChanged = new Signal<this, IChangedArgs<any>>(this);

  /**
   * The id for the Task.
   */
  readonly id: string;

  /**
   * The metadata associated with the Task.
   */
  get metadata(): IObservableJSON {
    return this.modelDB.get('metadata') as IObservableJSON;
  }

  /**
   * Get the trusted state of the model.
   */
  get trusted(): boolean {
    return this.modelDB.getValue('trusted') as boolean;
  }

  /**
   * Set the trusted state of the model.
   */
  set trusted(newValue: boolean) {
    let oldValue = this.trusted;
    if (oldValue === newValue) {
      return;
    }
    this.modelDB.setValue('trusted', newValue);
  }

  /**
   * Serialize the model to JSON.
   */
  toJSON(): tbformat.ITask {
    let metadata: tbformat.IBaseTaskMetadata = Object.create(null);
    for (let key of this.metadata.keys()) {
      let value = JSON.parse(JSON.stringify(this.metadata.get(key)));
      metadata[key] = value as JSONValue;
    }
    if (this.trusted) {
      metadata['trusted'] = true;
    }
    return {
      task_type: this.type,
      source: this.value.text,
      metadata,
    } as tbformat.ITask;
  }

  /**
   * Handle a change to the trusted state.
   *
   * The default implementation is a no-op.
   */
  onTrustedChanged(trusted: IObservableValue, args: ObservableValue.IChangedArgs): void { /* no-op */ }

  /**
   * Handle a change to the observable value.
   */
  protected onGenericChange(): void {
    this.contentChanged.emit(void 0);
  }
}


/**
 * The namespace for `TaskModel` statics.
 */
export
namespace TaskModel {
  /**
   * The options used to initialize a `TaskModel`.
   */
  export interface IOptions {
    /**
     * The source Task data.
     */
    task?: tbformat.IBaseTask

    /**
     * An IModelDB in which to store Task data.
     */
    modelDB?: IModelDB;

    /**
     * A unique identifier for this Task.
     */
    id?: string;
  }
}


/**
 * An implementation of a markdown Task model.
 */
export
class NotebookcellTaskModel extends TaskModel {
  /**
   * Construct a markdown Task model from optional Task content.
   */
  constructor(options: TaskModel.IOptions) {
    super(options);
    // Use the Github-flavored markdown mode.
    this.mimeType = 'text/x-ipythongfm';
  }

  /**
   * The type of the Task.
   */
  get type(): 'Notebookcell' {
    return 'Notebookcell';
  }
}


/**
 * An implementation of a code Task Model.
 */
export
class DataintegrationTaskModel extends TaskModel implements IDataintegrationTaskModel {
  /**
   * Construct a new code Task with optional original Task content.
   */
  constructor(options: DataintegrationTaskModel.IOptions) {
    super(options);
    let factory = (options.contentFactory ||
      DataintegrationTaskModel.defaultContentFactory
    );
    let trusted = this.trusted;
    let task = options.task as tbformat.IDataintegrationTask;
    let outputs: nbformat.IOutput[] = [];
    let executionCount = this.modelDB.createValue('executionCount');
    if (!executionCount.get()) {
      if (task && task.Task_type === 'code') {
        executionCount.set(task.execution_count || null);
        outputs = task.outputs;
      } else {
        executionCount.set(null);
      }
    }
    executionCount.changed.connect(this._onExecutionCountChanged, this);

    this._outputs = factory.createOutputArea({
      trusted,
      values: outputs,
      modelDB: this.modelDB
    });
    this._outputs.stateChanged.connect(this.onGenericChange, this);
  }

  /**
   * The type of the Task.
   */
  get type(): 'Dataintegration' {
    return 'Dataintegration';
  }

  /**
   * The execution count of the Task.
   */
  get executionCount(): nbformat.ExecutionCount {
    return this.modelDB.getValue('executionCount') as nbformat.ExecutionCount;
  }
  set executionCount(newValue: nbformat.ExecutionCount) {
    let oldValue = this.executionCount;
    if (newValue === oldValue) {
      return;
    }
    this.modelDB.setValue('executionCount', newValue || null);
  }

  /**
   * The Task outputs.
   */
  get outputs(): IOutputAreaModel {
    return this._outputs;
  }

  /**
   * Dispose of the resources held by the model.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._outputs.dispose();
    this._outputs = null;
    super.dispose();
  }

  /**
   * Serialize the model to JSON.
   */
  toJSON(): tbformat.IDataintegrationTask {
    let Task = super.toJSON() as tbformat.IDataintegrationTask;
    Task.execution_count = this.executionCount || null;
    Task.outputs = this.outputs.toJSON();
    return Task;
  }

  /**
   * Handle a change to the trusted state.
   */
  onTrustedChanged(trusted: IObservableValue, args: ObservableValue.IChangedArgs): void {
    if (this._outputs) {
      this._outputs.trusted = args.newValue as boolean;
    }
    this.stateChanged.emit({
      name: 'trusted',
      oldValue: args.oldValue,
      newValue: args.newValue
    });
  }

  /**
   * Handle a change to the execution count.
   */
  private _onExecutionCountChanged(count: IObservableValue, args: ObservableValue.IChangedArgs): void {
    this.contentChanged.emit(void 0);
    this.stateChanged.emit({
      name: 'executionCount',
      oldValue: args.oldValue,
      newValue: args.newValue });
  }


  private _outputs: IOutputAreaModel = null;
}


/**
 * The namespace for `CodeTaskModel` statics.
 */
export
namespace DataintegrationTaskModel {
  /**
   * The options used to initialize a `CodeTaskModel`.
   */
  export
  interface IOptions extends TaskModel.IOptions {
    /**
     * The factory for output area model creation.
     */
    contentFactory?: IContentFactory;
  }

  /**
   * A factory for creating code Task model content.
   */
  export
  interface IContentFactory {
    /**
     * Create an output area.
     */
    createOutputArea(options: IOutputAreaModel.IOptions): IOutputAreaModel;
  }

  /**
   * The default implementation of an `IContentFactory`.
   */
  export
  class ContentFactory {
    /**
     * Create an output area.
     */
    createOutputArea(options: IOutputAreaModel.IOptions): IOutputAreaModel {
      return new OutputAreaModel(options);
    }
  }

  /**
   * The shared `ConetntFactory` instance.
   */
  export
  const defaultContentFactory = new ContentFactory();
}
