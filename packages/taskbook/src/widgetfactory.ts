// Copyright


import {
  IEditorMimeTypeService
} from '@jupyterlab/codeeditor';

import {
  ABCWidgetFactory, DocumentRegistry
} from '@jupyterlab/docregistry';

import {
  RenderMime
} from '@jupyterlab/rendermime';

import {
  ToolbarItems
} from './toolbar';

import {
  ITaskbookModel
} from './model';

import {
  TaskbookPanel
} from './panel';


/**
 * A widget factory for taskbook panels.
 */
export
class TaskbookWidgetFactory extends ABCWidgetFactory<TaskbookPanel, ITaskbookModel> {
  /**
   * Construct a new taskbook widget factory.
   *
   * @param options - The options used to construct the factory.
   */
  constructor(options: TaskbookWidgetFactory.IOptions) {
    super(options);
    this.rendermime = options.rendermime;
    this.contentFactory = options.contentFactory;
    this.mimeTypeService = options.mimeTypeService;
  }

  /*
   * The rendermime instance.
   */
  readonly rendermime: RenderMime;

  /**
   * The content factory used by the widget factory.
   */
  readonly contentFactory: TaskbookPanel.IContentFactory;

  /**
   * The service used to look up mime types.
   */
  readonly mimeTypeService: IEditorMimeTypeService;

  /**
   * Create a new widget.
   *
   * #### Notes
   * The factory will start the appropriate kernel and populate
   * the default toolbar items using `ToolbarItems.populateDefaults`.
   */
  protected createNewWidget(context: DocumentRegistry.IContext<ITaskbookModel>): TaskbookPanel {
    let rendermime = this.rendermime.clone({ resolver: context });
    let panel = new TaskbookPanel({
      rendermime,
      contentFactory: this.contentFactory,
      mimeTypeService: this.mimeTypeService
    });
    panel.context = context;
    ToolbarItems.populateDefaults(panel);
    return panel;
  }
}


/**
 * The namespace for `TaskbookWidgetFactory` statics.
 */
export
namespace TaskbookWidgetFactory {
  /**
   * The options used to construct a `TaskbookWidgetFactory`.
   */
  export
  interface IOptions extends DocumentRegistry.IWidgetFactoryOptions {
     /*
      * A rendermime instance.
      */
    rendermime: RenderMime;

    /**
     * A taskbook panel content factory.
     */
    contentFactory: TaskbookPanel.IContentFactory;

    /**
     * The service used to look up mime types.
     */
    mimeTypeService: IEditorMimeTypeService;
  }
}
