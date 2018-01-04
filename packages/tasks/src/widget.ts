/*-----------------------------------------------------------------------------
| Copyright (c) Jupyter Development Team.
| Distributed under the terms of the Modified BSD License.
|----------------------------------------------------------------------------*/

import {
  KernelMessage
} from '@jupyterlab/services';

import {
  JSONValue, PromiseDelegate
} from '@phosphor/coreutils';

import {
  Message
} from '@phosphor/messaging';

import {
  PanelLayout, Panel, Widget
} from '@phosphor/widgets';

import {
  IClientSession
} from '@jupyterlab/apputils';

import {
  IChangedArgs, ActivityMonitor
} from '@jupyterlab/coreutils';

import {
  CodeEditor, CodeEditorWrapper
} from '@jupyterlab/codeeditor';

import {
  IRenderMime, MimeModel, RenderMime
} from '@jupyterlab/rendermime';

import {
  IObservableMap
} from '@jupyterlab/observables';

import {
  OutputArea, IOutputPrompt, OutputPrompt, IStdin, Stdin
} from '@jupyterlab/outputarea';

import {
  ITaskModel, IDataintegrationTaskModel,
  INotebookcellTaskModel
} from './model';

import {
  InputCollapser, OutputCollapser
} from './collapser';

import {
  InputArea, IInputPrompt, InputPrompt
} from './inputarea';

import {
  InputPlaceholder, OutputPlaceholder
} from './placeholder';

import {
  TaskHeader, TaskFooter, ITaskHeader, ITaskFooter
} from './headerfooter';


/**
 * The CSS class added to Task widgets.
 */
const TASK_CLASS = 'jp-Task';

/**
 * The CSS class added to the Task header.
 */
const TASK_HEADER_CLASS = 'jp-Task-header';

/**
 * The CSS class added to the Task footer.
 */
const TASK_FOOTER_CLASS = 'jp-Task-footer';

/**
 * The CSS class added to the Task input wrapper.
 */
const TASK_INPUT_WRAPPER_CLASS = 'jp-Task-inputWrapper';

/**
 * The CSS class added to the Task output wrapper.
 */
const TASK_OUTPUT_WRAPPER_CLASS = 'jp-Task-outputWrapper';

/**
 * The CSS class added to the Task input area.
 */
const TASK_INPUT_AREA_CLASS = 'jp-Task-inputArea';

/**
 * The CSS class added to the Task output area.
 */
const TASK_OUTPUT_AREA_CLASS = 'jp-Task-outputArea';

/**
 * The CSS class added to the Task input collapser.
 */
const TASK_INPUT_COLLAPSER_CLASS = 'jp-Task-inputCollapser';

/**
 * The CSS class added to the Task output collapser.
 */
const TASK_OUTPUT_COLLAPSER_CLASS = 'jp-Task-outputCollapser';

/**
 * The class name added to the Task when collapsed.
 */
const COLLAPSED_CLASS = 'jp-mod-collapsed';

/**
 * The class name added to the Task when readonly.
 */
const READONLY_CLASS = 'jp-mod-readOnly';

/**
 * The class name added to code Tasks.
 */
const CODE_TASK_CLASS = 'jp-CodeTask';

/**
 * The class name added to markdown Tasks.
 */
const MARKDOWN_TASK_CLASS = 'jp-MarkdownTask';

/**
 * The class name added to rendered markdown output widgets.
 */
const MARKDOWN_OUTPUT_CLASS = 'jp-MarkdownOutput';

/**
 * The class name added to a rendered input area.
 */
const RENDERED_CLASS = 'jp-mod-rendered';

const NO_OUTPUTS_CLASS = 'jp-mod-noOutputs';

/**
 * The text applied to an empty markdown Task.
 */
const DEFAULT_MARKDOWN_TEXT = 'Type Markdown and LaTeX: $ α^2 $';

/**
 * The timeout to wait for change activity to have ceased before rendering.
 */
const RENDER_TIMEOUT = 1000;

/******************************************************************************
 * Task
 ******************************************************************************/


/**
 * A base task widget.
 */
export
class Task extends Widget {
  /**
   * Construct a new base Task widget.
   */
  constructor(options: Task.IOptions) {
    super();
    this.addClass(TASK_CLASS);
    let model = this._model = options.model;
    let contentFactory = this.contentFactory = (
      options.contentFactory || Task.defaultContentFactory
    );
    this.layout = new PanelLayout();

    // Header
    let header = this._header = contentFactory.createTaskHeader();
    header.addClass(TASK_HEADER_CLASS);
    (this.layout as PanelLayout).addWidget(header);

    // Input
    let inputWrapper = this._inputWrapper = new Panel();
    inputWrapper.addClass(TASK_INPUT_WRAPPER_CLASS);
    let inputCollapser = this._inputCollapser = new InputCollapser();
    inputCollapser.addClass(TASK_INPUT_COLLAPSER_CLASS);
    let input = this._input = new InputArea({model, contentFactory });
    input.addClass(TASK_INPUT_AREA_CLASS);
    inputWrapper.addWidget(inputCollapser);
    inputWrapper.addWidget(input);
    (this.layout as PanelLayout).addWidget(inputWrapper);

    this._inputPlaceholder = new InputPlaceholder(() => {
      this.inputHidden = !this.inputHidden;
    });

    // Footer
    let footer = this._footer = this.contentFactory.createTaskFooter();
    footer.addClass(TASK_FOOTER_CLASS);
    (this.layout as PanelLayout).addWidget(footer);
  }

  /**
   * The content factory used by the widget.
   */
  readonly contentFactory: Task.IContentFactory;

  /**
   * Get the prompt node used by the Task.
   */
  get promptNode(): HTMLElement {
    if (!this._inputHidden) {
      return this._input.promptNode;
    } else {
      return ((this._inputPlaceholder.node as HTMLElement).firstElementChild as HTMLElement);
    }
  }

  /**
   * Get the CodeEditorWrapper used by the Task.
   */
  get editorWidget(): CodeEditorWrapper {
    return this._input.editorWidget;
  }

  /**
   * Get the CodeEditor used by the Task.
   */
  get editor(): CodeEditor.IEditor {
    return this._input.editor;
  }

  /**
   * Get the model used by the Task.
   */
  get model(): ITaskModel {
    return this._model;
  }

  /**
   * Get the input area for the Task.
   */
  get inputArea(): InputArea {
    return this._input;
  }

  /**
   * The read only state of the Task.
   */
  get readOnly(): boolean {
    return this._readOnly;
  }
  set readOnly(value: boolean) {
    if (value === this._readOnly) {
      return;
    }
    this._readOnly = value;
    this.update();
  }

  /**
   * A promise that resolves when the widget renders for the first time.
   */
  get ready(): Promise<void> {
    return Promise.resolve(undefined);
  }

  /**
   * Set the prompt for the widget.
   */
  setPrompt(value: string): void {
    this._input.setPrompt(value);
  }

  /**
   * The view state of input being hidden.
   */
  get inputHidden(): boolean {
    return this._inputHidden;
  }
  set inputHidden(value: boolean) {
    if (this._inputHidden === value) {
      return;
    }
    let layout = this._inputWrapper.layout as PanelLayout;
    if (value) {
      this._input.parent = null;
      layout.addWidget(this._inputPlaceholder);
    } else {
      this._inputPlaceholder.parent = null;
      layout.addWidget(this._input);
    }
    this._inputHidden = value;
    this.handleInputHidden(value);
  }

  /**
   * Handle the input being hidden.
   *
   * #### Notes
   * This is called by the `inputHidden` setter so that subclasses
   * can perform actions upon the input being hidden without accessing
   * private state.
   */
  protected handleInputHidden(value: boolean): void {
    return;
  }

  /**
   * Clone the Task, using the same model.
   */
  clone(): Task {
    let constructor = this.constructor as typeof Task;
    return new constructor({
      model: this.model,
      contentFactory: this.contentFactory
    });
  }

  /**
   * Dispose of the resources held by the widget.
   */
  dispose() {
    // Do nothing if already disposed.
    if (this.isDisposed) {
      return;
    }
    this._input = null;
    this._model = null;
    this._header = null;
    this._footer = null;
    this._inputCollapser = null;
    this._inputWrapper = null;
    this._inputPlaceholder = null;
    super.dispose();
  }

  /**
   * Handle `after-attach` messages.
   */
  protected onAfterAttach(msg: Message): void {
    this.update();
  }

  /**
   * Handle `'activate-request'` messages.
   */
  protected onActivateRequest(msg: Message): void {
    this.editor.focus();
  }

  /**
   * Handle `update-request` messages.
   */
  protected onUpdateRequest(msg: Message): void {
    if (!this._model) {
      return;
    }
    // Handle read only state.
    this.editor.setOption('readOnly', this._readOnly);
    this.toggleClass(READONLY_CLASS, this._readOnly);
  }

  private _readOnly = false;
  private _model: ITaskModel = null;
  private _header: ITaskHeader = null;
  private _footer: ITaskFooter = null;
  private _inputHidden = false;
  private _input: InputArea = null;
  private _inputCollapser: InputCollapser = null;
  private _inputWrapper: Widget = null;
  private _inputPlaceholder: InputPlaceholder = null;

}


/**
 * The namespace for the `Task` class statics.
 */
export
namespace Task {
  /**
   * An options object for initializing a Task widget.
   */
  export
  interface IOptions {
    /**
     * The model used by the Task.
     */
    model: ITaskModel;

    /**
     * The factory object for customizable Task children.
     */
    contentFactory?: IContentFactory;
  }

  /**
   * The factory object for customizable Task children.
   *
   * This is used to allow users of Tasks to customize child content.
   *
   * This inherits from `OutputArea.IContentFactory` to avoid needless nesting and
   * provide a single factory object for all notebook/Task/outputarea related
   * widgets.
   */
  export
  interface IContentFactory extends OutputArea.IContentFactory, InputArea.IContentFactory {
    /**
     * Create a new Task header for the parent widget.
     */
    createTaskHeader(): ITaskHeader;

    /**
     * Create a new Task header for the parent widget.
     */
    createTaskFooter(): ITaskFooter;

  }

  /**
   * The default implementation of an `IContentFactory`.
   *
   * This includes a CodeMirror editor factory to make it easy to use out of the box.
   */
  export
  class ContentFactory implements IContentFactory {
    /**
     * Create a content factory for a Task.
     */
    constructor(options: ContentFactory.IOptions = {}) {
      this._editorFactory = (options.editorFactory || InputArea.defaultEditorFactory);
    }

    /**
     * The readonly editor factory that create code editors
     */
    get editorFactory(): CodeEditor.Factory {
      return this._editorFactory;
    }

    /**
     * Create a new Task header for the parent widget.
     */
    createTaskHeader(): ITaskHeader {
      return new TaskHeader();
    }

    /**
     * Create a new Task header for the parent widget.
     */
    createTaskFooter(): ITaskFooter {
      return new TaskFooter();
    }

    /**
     * Create an input prompt.
     */
    createInputPrompt(): IInputPrompt {
      return new InputPrompt();
    }

    /**
     * Create the output prompt for the widget.
     */
    createOutputPrompt(): IOutputPrompt {
      return new OutputPrompt();
    }

    /**
     * Create an stdin widget.
     */
    createStdin(options: Stdin.IOptions): IStdin {
      return new Stdin(options);
    }

    private _editorFactory: CodeEditor.Factory = null;
  }

  /**
   * A namespace for Task content factory.
   */
  export
  namespace ContentFactory {
    /**
     * Options for the content factory.
     */
    export
    interface IOptions {
      /**
       * The editor factory used by the content factory.
       *
       * If this is not passed, a default CodeMirror editor factory
       * will be used.
       */
      editorFactory?: CodeEditor.Factory;
    }
  }

  /**
   * The default content factory for Tasks.
   */
  export
  const defaultContentFactory = new ContentFactory();
}

/******************************************************************************
 * DataintegrationTask
 ******************************************************************************/

/**
 * A widget for a Dataintegration Task.
 */
export
class DataintegrationTask extends Task {
  /**
   * Construct a code Task widget.
   */
  constructor(options: DataintegrationTask.IOptions) {
    super(options);
    this.addClass(CODE_TASK_CLASS);

    // Only save options not handled by parent constructor.
    let rendermime = this._rendermime = options.rendermime;
    let contentFactory = this.contentFactory;
    let model = this.model;

    // Code Tasks should not wrap lines.
    this.editor.setOption('lineWrap', false);

    // Insert the output before the Task footer.
    let outputWrapper = this._outputWrapper = new Panel();
    outputWrapper.addClass(TASK_OUTPUT_WRAPPER_CLASS);
    let outputCollapser = this._outputCollapser = new OutputCollapser();
    outputCollapser.addClass(TASK_OUTPUT_COLLAPSER_CLASS);
    let output = this._output = new OutputArea({
      model: model.outputs,
      rendermime,
      contentFactory: contentFactory
    });
    output.addClass(TASK_OUTPUT_AREA_CLASS);
    // Set a CSS if there are no outputs, and connect a signal for future
    // changes to the number of outputs. This is for conditional styling
    // if there are no outputs.
    if (model.outputs.length === 0) {
      this.addClass(NO_OUTPUTS_CLASS);
    }
    output.outputLengthChanged.connect(this._outputLengthHandler, this);
    outputWrapper.addWidget(outputCollapser);
    outputWrapper.addWidget(output);
    (this.layout as PanelLayout).insertWidget(2, outputWrapper);

    this._outputPlaceholder = new OutputPlaceholder(() => {
      this.outputHidden = !this.outputHidden;
    });

    // Modify state
    this.setPrompt(`${model.executionCount || ''}`);
    model.stateChanged.connect(this.onStateChanged, this);
    model.metadata.changed.connect(this.onMetadataChanged, this);
  }

  /**
   * The model used by the widget.
   */
  readonly model: IDataintegrationTaskModel;

  /**
   * Get the output area for the Task.
   */
  get outputArea(): OutputArea {
    return this._output;
  }

  /**
   * The view state of output being collapsed.
   */
  get outputHidden(): boolean {
    return this._outputHidden;
  }
  set outputHidden(value: boolean) {
    if (this._outputHidden === value) {
      return;
    }
    let layout = this._outputWrapper.layout as PanelLayout;
    if (value) {
      layout.removeWidget(this._output);
      layout.addWidget(this._outputPlaceholder);
      if (this.inputHidden && !this._outputWrapper.isHidden) {
        this._outputWrapper.hide();
      }
    } else {
      if (this._outputWrapper.isHidden) {
        this._outputWrapper.show();
      }
      layout.removeWidget(this._outputPlaceholder);
      layout.addWidget(this._output);
    }
    this._outputHidden = value;
  }

  /**
   * Handle the input being hidden.
   *
   * #### Notes
   * This method is called by the case Task implementation and is
   * subclasses here so the code Task can watch to see when input
   * is hidden without accessing private state.
   */
  protected handleInputHidden(value: boolean): void {
    if (!value && this._outputWrapper.isHidden) {
      this._outputWrapper.show();
    } else if (value && !this._outputWrapper.isHidden && this._outputHidden) {
      this._outputWrapper.hide();
    }
  }

  /**
   * Clone the Task, using the same model.
   */
  clone(): DataintegrationTask {
    let constructor = this.constructor as typeof DataintegrationTask;
    return new constructor({
      model: this.model,
      contentFactory: this.contentFactory,
      rendermime: this._rendermime
    });
  }

  /**
   * Dispose of the resources used by the widget.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._output.outputLengthChanged.disconnect(this._outputLengthHandler, this);
    this._rendermime = null;
    this._output = null;
    this._outputWrapper = null;
    this._outputCollapser = null;
    this._outputPlaceholder = null;
    super.dispose();
  }

  /**
   * Handle `update-request` messages.
   */
  protected onUpdateRequest(msg: Message): void {
    let value = this.model.metadata.get('collapsed') as boolean;
    this.toggleClass(COLLAPSED_CLASS, value);
    if (this._output) {
      // TODO: handle scrolled state.
    }
    super.onUpdateRequest(msg);
  }

  /**
   * Handle changes in the model.
   */
  protected onStateChanged(model: ITaskModel, args: IChangedArgs<any>): void {
    switch (args.name) {
    case 'executionCount':
      this.setPrompt(`${(model as IDataintegrationTaskModel).executionCount || ''}`);
      break;
    default:
      break;
    }
  }

  /**
   * Handle changes in the metadata.
   */
  protected onMetadataChanged(model: IObservableMap<JSONValue>, args: IObservableMap.IChangedArgs<JSONValue>): void {
    switch (args.key) {
    case 'collapsed':
    case 'scrolled':
      this.update();
      break;
    default:
      break;
    }
  }

  /**
   * Handle changes in the number of outputs in the output area.
   */
  private _outputLengthHandler(sender: OutputArea, args: number) {
    let force = args === 0 ? true : false;
    this.toggleClass(NO_OUTPUTS_CLASS, force);
  }

  private _rendermime: RenderMime = null;
  private _outputHidden = false;
  private _outputWrapper: Widget = null;
  private _outputCollapser: OutputCollapser = null;
  private _outputPlaceholder: OutputPlaceholder = null;
  private _output: OutputArea = null;
}


/**
 * The namespace for the `CodeTask` class statics.
 */
export
namespace DataintegrationTask {
  /**
   * An options object for initializing a base Task widget.
   */
  export
  interface IOptions extends Task.IOptions {
    /**
     * The model used by the Task.
     */
    model: IDataintegrationTaskModel;

    /**
     * The mime renderer for the Task widget.
     */
    rendermime: RenderMime;
  }

  /**
   * Execute a Task given a client session.
   */
  export
  function execute(Task: DataintegrationTask, session: IClientSession): Promise<KernelMessage.IExecuteReplyMsg> {
    let model = Task.model;
    let code = model.value.text;
    if (!code.trim() || !session.kernel) {
      model.executionCount = null;
      model.outputs.clear();
      return Promise.resolve(void 0);
    }

    model.executionCount = null;
    Task.outputHidden = false;
    Task.setPrompt('*');
    model.trusted = true;

    return OutputArea.execute(code, Task.outputArea, session).then(msg => {
      model.executionCount = msg.content.execution_count;
      return msg;
    });
  }
}


/******************************************************************************
 * NotebookcellTask
 ******************************************************************************/

/**
 * A widget for a Notebookcell Task.
 *
 * #### Notes
 * Things get complicated if we want the rendered text to update
 * any time the text changes, the text editor model changes,
 * or the input area model changes.  We don't support automatically
 * updating the rendered text in all of these cases.
 */
export
class NotebookcellTask extends Task {
  /**
   * Construct a Markdown Notebookcell widget.
   */
  constructor(options: NotebookcellTask.IOptions) {
    super(options);
    this.addClass(MARKDOWN_TASK_CLASS);
    this._rendermime = options.rendermime;

    // Throttle the rendering rate of the widget.
    this._monitor = new ActivityMonitor({
      signal: this.model.contentChanged,
      timeout: RENDER_TIMEOUT
    });
    this._monitor.activityStopped.connect(() => {
      if (this._rendered) {
        this.update();
      }
    }, this);

    this._updateRenderedInput().then(() => {
      this._ready.resolve(void 0);
    });
  }

  /**
   * The model used by the widget.
   */
  readonly model: INotebookcellTaskModel;

  /**
   * A promise that resolves when the widget renders for the first time.
   */
  get ready(): Promise<void> {
    return this._ready.promise;
  }

  /**
   * Whether the Task is rendered.
   */
  get rendered(): boolean {
    return this._rendered;
  }
  set rendered(value: boolean) {
    if (value === this._rendered) {
      return;
    }
    this._rendered = value;
    this._handleRendered();
  }

  /**
   * Render an input instead of the text editor.
   */
  protected renderInput(widget: Widget): void {
    this.addClass(RENDERED_CLASS);
    this.inputArea.renderInput(widget);
  }

  /**
   * Show the text editor instead of rendered input.
   */
  protected showEditor(): void {
    this.removeClass(RENDERED_CLASS);
    this.inputArea.showEditor();
  }

  /*
   * Handle `update-request` messages.
   */
  protected onUpdateRequest(msg: Message): void {
    // Make sure we are properly rendered.
    this._handleRendered();
    super.onUpdateRequest(msg);
  }

  /**
   * Handle the rendered state.
   */
  private _handleRendered(): void {
    if (!this._rendered) {
      this.showEditor();
    } else {
      this._updateRenderedInput();
      this.renderInput(this._renderer);
    }
  }

  /**
   * Update the rendered input.
   */
  private _updateRenderedInput(): Promise<void> {
    let model = this.model;
    let text = model && model.value.text || DEFAULT_MARKDOWN_TEXT;
    // Do not re-render if the text has not changed.
    if (text !== this._prevText) {
      let mimeModel = new MimeModel({ data: { 'text/markdown': text }});
      if (!this._renderer) {
        this._renderer = this._rendermime.createRenderer('text/markdown');
        this._renderer.addClass(MARKDOWN_OUTPUT_CLASS);
      }
      this._prevText = text;
      return this._renderer.renderModel(mimeModel);
    }
    return Promise.resolve(void 0);
  }

  /**
   * Clone the Task, using the same model.
   */
  clone(): NotebookcellTask {
    let constructor = this.constructor as typeof NotebookcellTask;
    return new constructor({
      model: this.model,
      contentFactory: this.contentFactory,
      rendermime: this._rendermime
    });
  }

  private _monitor: ActivityMonitor<any, any> = null;
  private _renderer: IRenderMime.IRenderer = null;
  private _rendermime: RenderMime;
  private _rendered = true;
  private _prevText = '';
  private _ready = new PromiseDelegate<void>();
}


/**
 * The namespace for the `CodeTask` class statics.
 */
export
namespace NotebookcellTask {
  /**
   * An options object for initializing a base Task widget.
   */
  export
  interface IOptions extends Task.IOptions {
    /**
     * The model used by the Task.
     */
    model: INotebookcellTaskModel;

    /**
     * The mime renderer for the Task widget.
     */
    rendermime: RenderMime;

  }
}
