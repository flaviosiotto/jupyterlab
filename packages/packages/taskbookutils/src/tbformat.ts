// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
// Taskbook format interfaces
// https://tbformat.readthedocs.io/en/latest/format_description.html
// https://github.com/jupyter/tbformat/blob/master/tbformat/v4/tbformat.v4.schema.json
import {
  JSONObject
} from '@phosphor/coreutils';

import {
  nbformat
} from '@jupyterlab/coreutils';


/**
 * A namespace for tbformat interfaces.
 */
export
namespace tbformat {

  /**
   * The default metadata for the notebook.
   */
  export
  interface ITaskbookMetadata extends nbformat.INotebookMetadata {
  }

  /**
   * The taskbook content.
   */
  export
  interface ITaskbookContent extends nbformat.INotebookContent {
    tasks: ITask[];
  }


  /**
   * A type which describes the type of cell.
   */
  export
  type TaskType = 'Dataintegration' | 'Notebookcell';

  /**
   * Task-level metadata.
   */
  export
  interface IBaseTaskMetadata extends JSONObject {
    /**
     * Whether the cell is trusted.
     *
     * #### Notes
     * This is not strictly part of the tbformat spec, but it is added by
     * the contents manager.
     *
     * See https://jupyter-notebook.readthedocs.io/en/latest/security.html.
     */
    trusted: boolean;

    /**
     * The cell's name. If present, must be a non-empty string.
     */
    name: string;

    /**
     * The cell's tags. Tags must be unique, and must not contain commas.
     */
    tags: string[];
  }

  /**
   * The base task interface.
   */
  export
  interface IBaseTask extends JSONObject {
    /**
     * String identifying the type of cell.
     */
    task_type: string;

    /**
     * Contents of the task, represented as an array of lines.
     */
    source: nbformat.MultilineString;

    /**
     * Cell-level metadata.
     */
    metadata: Partial<ITaskMetadata>;
  }


  /**
   * Metadata for a Dataintegration task.
   */
  export
  interface IDataintegrationTaskMetadata extends IBaseTaskMetadata {
    /**
     * Whether the cell is collapsed/expanded.
     */
    collapsed: boolean;

    /**
     * Whether the cell's output is scrolled, unscrolled, or autoscrolled.
     */
    scrolled: boolean | 'auto';
  }

  /**
   * A Dataintegration task.
   */
  export
  interface IDataintegrationTask extends IBaseTask {
    /**
     * String identifying the type of task.
     */
    task_type: 'Dataintegration';

    /**
     * Task-level metadata.
     */
    metadata: Partial<IDataintegrationTaskMetadata>;

    /**
     * Execution, display, or stream outputs.
     */
    outputs: nbformat.IOutput[];

    /**
     * The code cell's prompt number. Will be null if the cell has not been run.
     */
    execution_count: nbformat.ExecutionCount;
  }


  /**
   * Metadata for a code cell.
   */
  export
  interface INotebookcellTaskMetadata extends IBaseTaskMetadata {
    /**
     * Whether the cell is collapsed/expanded.
     */
    collapsed: boolean;

    /**
     * Whether the cell's output is scrolled, unscrolled, or autoscrolled.
     */
    scrolled: boolean | 'auto';
  }

  /**
   * A Dataintegration task.
   */
  export
  interface INotebookcellTask extends IBaseTask {
    /**
     * String identifying the type of task.
     */
    task_type: 'Notebookcell';

    /**
     * Task-level metadata.
     */
    metadata: Partial<INotebookcellTaskMetadata>;

    /**
     * Execution, display, or stream outputs.
     */
    outputs: nbformat.IOutput[];

    /**
     * The code cell's prompt number. Will be null if the cell has not been run.
     */
    execution_count: nbformat.ExecutionCount;
  }


  /**
   * A task union type.
   */
  export
  type ITask = INotebookcellTask | IDataintegrationTask;

  /**
   * Test whether a task is a Dataintegration task.
   */
  export
  function isDataintegration(task: ITask): task is IDataintegrationTask {
    return task.cell_type === 'Dataintegration';
  }

  /**
   * Test whether a task is a Notebookcell task.
   */
  export
  function isNotebookcell(task: ITask): task is INotebookcellTask {
    return task.cell_type === 'Notebookcell';
  }

  /**
   * A union metadata type.
   */
  export
  type ITaskMetadata = IBaseTaskMetadata | IDataintegrationTaskMetadata | INotebookcellTaskMetadata;

}
