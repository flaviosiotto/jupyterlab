// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  DataintegrationTaskModel
} from '@jupyterlab/tasks';

import {
  DocumentRegistry
} from '@jupyterlab/docregistry';

import {
  IModelDB
} from '@jupyterlab/observables';

import {
  Contents
} from '@jupyterlab/services';

import {
  ITaskbookModel, TaskbookModel
} from './model';


/**
 * A model factory for notebooks.
 */
export
class TaskbookModelFactory implements DocumentRegistry.IModelFactory<ITaskbookModel> {
  /**
   * Construct a new notebook model factory.
   */
  constructor(options: TaskbookModelFactory.IOptions) {
    let DataintegrationTaskContentFactory = options.DataintegrationTaskContentFactory;
    this.contentFactory = (options.contentFactory ||
      new TaskbookModel.ContentFactory({ DataintegrationTaskContentFactory })
    );
  }

  /**
   * The content model factory used by the NotebookModelFactory.
   */
  readonly contentFactory: TaskbookModel.IContentFactory;

  /**
   * The name of the model.
   */
  get name(): string {
    return 'taskbook';
  }

  /**
   * The content type of the file.
   */
  get contentType(): Contents.ContentType {
    return 'file';
  }

  /**
   * The format of the file.
   */
  get fileFormat(): Contents.FileFormat {
    return 'json';
  }

  /**
   * Get whether the model factory has been disposed.
   */
  get isDisposed(): boolean {
    return this._disposed;
  }

  /**
   * Dispose of the model factory.
   */
  dispose(): void {
    this._disposed = true;
  }

  /**
   * Create a new model for a given path.
   *
   * @param languagePreference - An optional kernel language preference.
   *
   * @returns A new document model.
   */
  createNew(languagePreference?: string, modelDB?: IModelDB): ITaskbookModel {
    let contentFactory = this.contentFactory;
    return new TaskbookModel({ languagePreference, contentFactory, modelDB });
  }

  /**
   * Get the preferred kernel language given a path.
   */
  preferredLanguage(path: string): string {
    return '';
  }

  private _disposed = false;
}


/**
 * The namespace for notebook model factory statics.
 */
export
namespace TaskbookModelFactory {
  /**
   * The options used to initialize a NotebookModelFactory.
   */
  export
  interface IOptions {
    /**
     * The factory for Dataintegration task content.
     */
    DataintegrationTaskContentFactory?: DataintegrationTaskModel.IContentFactory;

    /**
     * The content factory used by the NotebookModelFactory.  If
     * given, it will supercede the `codeCellContentFactory`.
     */
    contentFactory?: TaskbookModel.IContentFactory;
  }
}
