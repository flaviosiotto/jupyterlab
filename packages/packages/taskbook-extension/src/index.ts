// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ILayoutRestorer, JupyterLab, JupyterLabPlugin
} from '@jupyterlab/application';

import {
  Dialog, ICommandPalette, showDialog
} from '@jupyterlab/apputils';

import {
  IEditorServices
} from '@jupyterlab/codeeditor';

import {
  PageConfig, URLExt, uuid
} from '@jupyterlab/coreutils';

import  {
  IFileBrowserFactory
} from '@jupyterlab/filebrowser';

import {
  ILauncher
} from '@jupyterlab/launcher';

import {
  IMainMenu, IEditMenu, IFileMenu, IKernelMenu, IRunMenu, IViewMenu
} from '@jupyterlab/mainmenu';

import {
  ITaskbookTracker, TaskbookTracker,
  TaskbookActions,
  TaskbookModelFactory,  TaskbookPanel, TaskbookWidgetFactory
} from '@jupyterlab/taskbook';

import {
  ServiceManager
} from '@jupyterlab/services';

import {
  ReadonlyJSONObject
} from '@phosphor/coreutils';

import {
  Message
} from '@phosphor/messaging';

import {
  Menu, Panel
} from '@phosphor/widgets';



/**
 * The command IDs used by the taskbook plugin.
 */
namespace CommandIDs {
  export
  const createNew = 'taskbook:create-new';

  export
  const interrupt = 'taskbook:interrupt-kernel';

  export
  const restart = 'taskbook:restart-kernel';

  export
  const restartClear = 'taskbook:restart-clear-output';

  export
  const restartRunAll = 'taskbook:restart-run-all';

  export
  const reconnectToKernel = 'taskbook:reconnect-to-kernel';

  export
  const changeKernel = 'taskbook:change-kernel';

  export
  const createConsole = 'taskbook:create-console';

  export
  const createTaskView = 'taskbook:create-task-view';

  export
  const clearAllOutputs = 'taskbook:clear-all-task-outputs';

  export
  const closeAndShutdown = 'taskbook:close-and-shutdown';

  export
  const trust = 'taskbook:trust';

  export
  const exportToFormat = 'taskbook:export-to-format';

  export
  const run = 'taskbook:run-task';

  export
  const runAndAdvance = 'taskbook:run-task-and-select-next';

  export
  const runAndInsert = 'taskbook:run-task-and-insert-below';

  export
  const runAll = 'taskbook:run-all-tasks';

  export
  const toCode = 'taskbook:change-task-to-code';

  export
  const toMarkdown = 'taskbook:change-task-to-markdown';

  export
  const toRaw = 'taskbook:change-task-to-raw';

  export
  const cut = 'taskbook:cut-task';

  export
  const copy = 'taskbook:copy-task';

  export
  const paste = 'taskbook:paste-task';

  export
  const moveUp = 'taskbook:move-task-up';

  export
  const moveDown = 'taskbook:move-task-down';

  export
  const clearOutputs = 'taskbook:clear-task-output';

  export
  const deleteTask = 'taskbook:delete-task';

  export
  const insertAbove = 'taskbook:insert-task-above';

  export
  const insertBelow = 'taskbook:insert-task-below';

  export
  const selectAbove = 'taskbook:move-cursor-up';

  export
  const selectBelow = 'taskbook:move-cursor-down';

  export
  const extendAbove = 'taskbook:extend-marked-tasks-above';

  export
  const extendBelow = 'taskbook:extend-marked-tasks-below';

  export
  const editMode = 'taskbook:enter-edit-mode';

  export
  const merge = 'taskbook:merge-tasks';

  export
  const split = 'taskbook:split-task-at-cursor';

  export
  const commandMode = 'taskbook:enter-command-mode';

  export
  const toggleAllLines = 'taskbook:toggle-all-task-line-numbers';

  export
  const undoTaskAction = 'taskbook:undo-task-action';

  export
  const redoTaskAction = 'taskbook:redo-task-action';

  export
  const markdown1 = 'taskbook:change-task-to-heading-1';

  export
  const markdown2 = 'taskbook:change-task-to-heading-2';

  export
  const markdown3 = 'taskbook:change-task-to-heading-3';

  export
  const markdown4 = 'taskbook:change-task-to-heading-4';

  export
  const markdown5 = 'taskbook:change-task-to-heading-5';

  export
  const markdown6 = 'taskbook:change-task-to-heading-6';

  export
  const hideCode = 'taskbook:hide-task-code';

  export
  const showCode = 'taskbook:show-task-code';

  export
  const hideAllCode = 'taskbook:hide-all-task-code';

  export
  const showAllCode = 'taskbook:show-all-task-code';

  export
  const hideOutput = 'taskbook:hide-task-outputs';

  export
  const showOutput = 'taskbook:show-task-outputs';

  export
  const hideAllOutputs = 'taskbook:hide-all-task-outputs';

  export
  const showAllOutputs = 'taskbook:show-all-task-outputs';

}


/**
 * The class name for the taskbook icon from the default theme.
 */
const TASKBOOK_ICON_CLASS = 'jp-TaskbookRunningIcon';

/**
 * The name of the factory that creates taskbooks.
 */
const FACTORY = 'Taskbook';

/**
 * The allowed Export To ... formats and their human readable labels.
 */
const EXPORT_TO_FORMATS = [
  { 'format': 'html', 'label': 'HTML' },
  { 'format': 'latex', 'label': 'LaTeX' },
  { 'format': 'markdown', 'label': 'Markdown' },
  { 'format': 'pdf', 'label': 'PDF' },
  { 'format': 'rst', 'label': 'ReStructured Text' },
  { 'format': 'script', 'label': 'Executable Script' },
  { 'format': 'slides', 'label': 'Reveal JS' }
];


/**
 * The taskbook widget tracker provider.
 */
const tracker: JupyterLabPlugin<ITaskbookTracker> = {
  id: '@jupyterlab/taskbook-extension:tracker',
  provides: ITaskbookTracker,
  requires: [
    IMainMenu,
    ICommandPalette,
    TaskbookPanel.IContentFactory,
    IEditorServices,
    ILayoutRestorer
  ],
  optional: [IFileBrowserFactory, ILauncher],
  activate: activateTaskbookHandler,
  autoStart: true
};


/**
 * The taskbook task factory provider.
 */
const factory: JupyterLabPlugin<TaskbookPanel.IContentFactory> = {
  id: '@jupyterlab/taskbook-extension:factory',
  provides: TaskbookPanel.IContentFactory,
  requires: [IEditorServices],
  autoStart: true,
  activate: (app: JupyterLab, editorServices: IEditorServices) => {
    let editorFactory = editorServices.factoryService.newInlineEditor.bind(
      editorServices.factoryService);
    return new TaskbookPanel.ContentFactory({ editorFactory });
  }
};

/**
 * The task tools extension.
 */
/*const tools: JupyterLabPlugin<ITaskTools> = {
  activate: activateTaskTools,
  provides: ITaskTools,
  id: '@jupyterlab/taskbook-extension:tools',
  autoStart: true,
  requires: [ITaskbookTracker, IEditorServices, IStateDB]
};
*/

/**
 * Export the plugins as default.
 */
//const plugins: JupyterLabPlugin<any>[] = [factory, tracker, tools];
const plugins: JupyterLabPlugin<any>[] = [factory, tracker];
export default plugins;


/**
 * Activate the task tools extension.
 */
/*function activateTaskTools(app: JupyterLab, tracker: ITaskbookTracker, editorServices: IEditorServices, state: IStateDB): Promise<ITaskTools> {
  const id = 'task-tools';
  const tasktools = new TaskTools({ tracker });
  const activeTaskTool = new TaskTools.ActiveTaskTool();
  const slideShow = TaskTools.createSlideShowSelector();
  const nbConvert = TaskTools.createNBConvertSelector();
  const editorFactory = editorServices.factoryService.newInlineEditor
    .bind(editorServices.factoryService);
  const metadataEditor = new TaskTools.MetadataEditorTool({ editorFactory });

  // Create message hook for triggers to save to the database.
  const hook = (sender: any, message: Message): boolean => {
    switch (message) {
      case Widget.Msg.ActivateRequest:
        state.save(id, { open: true });
        break;
      case Widget.Msg.AfterHide:
      case Widget.Msg.CloseRequest:
        state.remove(id);
        break;
      default:
        break;
    }
    return true;
  };

  tasktools.title.label = 'Task Tools';
  tasktools.id = id;
  tasktools.addItem({ tool: activeTaskTool, rank: 1 });
  tasktools.addItem({ tool: slideShow, rank: 2 });
  tasktools.addItem({ tool: nbConvert, rank: 3 });
  tasktools.addItem({ tool: metadataEditor, rank: 4 });
  MessageLoop.installMessageHook(tasktools, hook);

  // Wait until the application has finished restoring before rendering.
  Promise.all([state.fetch(id), app.restored]).then(([args]) => {
    const open = !!(args && (args as ReadonlyJSONObject)['open'] as boolean);

    // After initial restoration, check if the task tools should render.
    if (tracker.size) {
      app.shell.addToLeftArea(tasktools);
      if (open) {
        app.shell.activateById(tasktools.id);
      }
    }

    // For all subsequent widget changes, check if the task tools should render.
    app.shell.currentChanged.connect((sender, args) => {
      // If there are any open taskbooks, add task tools to the side panel if
      // it is not already there.
      if (tracker.size) {
        if (!tasktools.isAttached) {
          app.shell.addToLeftArea(tasktools);
        }
        return;
      }
      // If there are no taskbooks, close task tools.
      tasktools.close();
    });
  });

  return Promise.resolve(tasktools);
}
*/

/**
 * Activate the taskbook handler extension.
 */
function activateTaskbookHandler(app: JupyterLab, mainMenu: IMainMenu, palette: ICommandPalette, contentFactory: TaskbookPanel.IContentFactory, editorServices: IEditorServices, restorer: ILayoutRestorer, browserFactory: IFileBrowserFactory | null, launcher: ILauncher | null): ITaskbookTracker {
  const services = app.serviceManager;
  const factory = new TaskbookWidgetFactory({
    name: FACTORY,
    fileTypes: ['taskbook'],
    modelName: 'taskbook',
    defaultFor: ['taskbook'],
    preferKernel: true,
    canStartKernel: true,
    rendermime: app.rendermime,
    contentFactory,
    mimeTypeService: editorServices.mimeTypeService
  });
  const { commands } = app;
  const tracker = new TaskbookTracker({ namespace: 'taskbook' });

  // Handle state restoration.
  restorer.restore(tracker, {
    command: 'docmanager:open',
    args: panel => ({ path: panel.context.path, factory: FACTORY }),
    name: panel => panel.context.path,
    when: services.ready
  });

  let registry = app.docRegistry;
  registry.addModelFactory(new TaskbookModelFactory({}));
  registry.addWidgetFactory(factory);

  addCommands(app, services, tracker);
  populatePalette(palette);

  let id = 0; // The ID counter for taskbook panels.

  factory.widgetCreated.connect((sender, widget) => {
    // If the taskbook panel does not have an ID, assign it one.
    widget.id = widget.id || `taskbook-${++id}`;
    widget.title.icon = TASKBOOK_ICON_CLASS;
    // Notify the instance tracker if restore data needs to update.
    widget.context.pathChanged.connect(() => { tracker.save(widget); });
    // Add the taskbook panel to the tracker.
    tracker.add(widget);
  });

  // Add main menu taskbook menu.
  populateMenus(app, mainMenu, tracker);

  // Utility function to create a new taskbook.
  const createNew = (cwd: string, kernelName?: string) => {
    return commands.execute(
      'docmanager:new-untitled', { path: cwd, type: 'taskbook' }
    ).then(model => {
      return commands.execute('docmanager:open', {
        path: model.path, factory: FACTORY,
        kernel: { name: kernelName }
      });
    });
  };

  // Add a command for creating a new taskbook in the File Menu.
  commands.addCommand(CommandIDs.createNew, {
    label: 'Taskbook',
    caption: 'Create a new taskbook',
    execute: () => {
      let cwd = browserFactory ?
        browserFactory.defaultBrowser.model.path : '';
      return createNew(cwd);
    }
  });


  // Add a launcher item if the launcher is available.
  if (launcher) {
    services.ready.then(() => {
      const specs = services.specs;
      const baseUrl = PageConfig.getBaseUrl();

      for (let name in specs.kernelspecs) {
        let displayName = specs.kernelspecs[name].display_name;
        let rank = name === specs.default ? 0 : Infinity;
        let kernelIconUrl = specs.kernelspecs[name].resources['logo-64x64'];
        if (kernelIconUrl) {
          let index = kernelIconUrl.indexOf('kernelspecs');
          kernelIconUrl = baseUrl + kernelIconUrl.slice(index);
        }
        launcher.add({
          displayName,
          category: 'Taskbook',
          name,
          iconClass: 'jp-TaskbookRunningIcon',
          callback: createNew,
          rank,
          kernelIconUrl
        });
      }
    });
  }

  app.contextMenu.addItem({
    command: CommandIDs.clearOutputs,
    selector: '.jp-Taskbook .jp-Task'
  });
  app.contextMenu.addItem({
    command: CommandIDs.split,
    selector: '.jp-Taskbook .jp-Task'
  });
  app.contextMenu.addItem({
    command: CommandIDs.createTaskView,
    selector: '.jp-Taskbook .jp-Task'
  });
  app.contextMenu.addItem({
    type: 'separator',
    selector: '.jp-Taskbook',
    rank: 0
  });
  app.contextMenu.addItem({
    command: CommandIDs.undoTaskAction,
    selector: '.jp-Taskbook',
    rank: 1
  });
  app.contextMenu.addItem({
    command: CommandIDs.redoTaskAction,
    selector: '.jp-Taskbook',
    rank: 2
  });
  app.contextMenu.addItem({
    type: 'separator',
    selector: '.jp-Taskbook',
    rank: 0
  });
  app.contextMenu.addItem({
    command: CommandIDs.createConsole,
    selector: '.jp-Taskbook',
    rank: 3
  });
  app.contextMenu.addItem({
    command: CommandIDs.clearAllOutputs,
    selector: '.jp-Taskbook',
    rank: 3
  });

  return tracker;
}



/**
 * Add the taskbook commands to the application's command registry.
 */
function addCommands(app: JupyterLab, services: ServiceManager, tracker: TaskbookTracker): void {
  const { commands, shell } = app;

  // Get the current widget and activate unless the args specify otherwise.
  function getCurrent(args: ReadonlyJSONObject): TaskbookPanel | null {
    const widget = tracker.currentWidget;
    const activate = args['activate'] !== false;

    if (activate && widget) {
      shell.activateById(widget.id);
    }

    return widget;
  }

  /**
   * Whether there is an active taskbook.
   */
  function isEnabled(): boolean {
    return tracker.currentWidget !== null &&
           tracker.currentWidget === app.shell.currentWidget;
  }

  /**
   * The name of the current taskbook widget.
   */
  function currentName(): string {
    if (tracker.currentWidget  &&
        tracker.currentWidget === app.shell.currentWidget &&
        tracker.currentWidget.title.label) {
      return `"${tracker.currentWidget.title.label}"`;
    }
    return 'Taskbook';
  }

  commands.addCommand(CommandIDs.run, {
    label: 'Run Task(s)',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        const { context, taskbook } = current;

        return TaskbookActions.run(taskbook, context.session);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.runAll, {
    label: 'Run All Tasks',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        const { context, taskbook } = current;

        return TaskbookActions.runAll(taskbook, context.session);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.restart, {
    label: 'Restart Kernel',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return current.session.restart();
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.closeAndShutdown, {
    label: 'Close and Shutdown',
    execute: args => {
      const current = getCurrent(args);

      if (!current) {
        return;
      }

      const fileName = current.title.label;

      return showDialog({
        title: 'Shutdown the taskbook?',
        body: `Are you sure you want to close "${fileName}"?`,
        buttons: [Dialog.cancelButton(), Dialog.warnButton()]
      }).then(result => {
        if (result.button.accept) {
          return current.context.session.shutdown()
            .then(() => { current.dispose(); });
        }
      });
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.trust, {
    label: () => `Trust ${currentName()}`,
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        const { context, taskbook } = current;

        return TaskbookActions.trust(taskbook).then(() => context.save());
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.exportToFormat, {
    label: args => {
        const formatLabel = (args['label']) as string;
        const name = currentName();

        return (args['isPalette'] ? `Export ${name} to ` : '') + formatLabel;
    },
    execute: args => {
      const current = getCurrent(args);

      if (!current) {
        return;
      }

      const taskbookPath = URLExt.encodeParts(current.context.path);
      const url = URLExt.join(
        services.serverSettings.baseUrl,
        'nbconvert',
        (args['format']) as string,
        taskbookPath
      ) + '?download=true';
      const child = window.open('', '_blank');
      const { context } = current;

      if (context.model.dirty && !context.model.readOnly) {
        return context.save().then(() => { child.location.assign(url); });
      }

      return new Promise<void>((resolve) => {
        child.location.assign(url);
        resolve(undefined);
      });
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.restartRunAll, {
    label: 'Restart Kernel & Run All',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        const { context, taskbook, session } = current;

        return session.restart()
          .then(() => { TaskbookActions.runAll(taskbook, context.session); });
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.interrupt, {
    label: 'Interrupt Kernel',
    execute: args => {
      const current = getCurrent(args);

      if (!current) {
        return;
      }

      const kernel = current.context.session.kernel;

      if (kernel) {
        return kernel.interrupt();
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.toCode, {
    label: 'Change to Dataintegration Task Type',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return TaskbookActions.changeTaskType(current.taskbook, 'Dataintegration');
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.toMarkdown, {
    label: 'Change to Notebookcell Task Type',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return TaskbookActions.changeTaskType(current.taskbook, 'Notebookcell');
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.cut, {
    label: 'Cut Task(s)',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return TaskbookActions.cut(current.taskbook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.copy, {
    label: 'Copy Task(s)',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return TaskbookActions.copy(current.taskbook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.paste, {
    label: 'Paste Task(s) Below',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return TaskbookActions.paste(current.taskbook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.deleteTask, {
    label: 'Delete Task(s)',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return TaskbookActions.deleteTasks(current.taskbook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.split, {
    label: 'Split Task',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return TaskbookActions.splitTask(current.taskbook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.insertAbove, {
    label: 'Insert Task Above',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return TaskbookActions.insertAbove(current.taskbook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.insertBelow, {
    label: 'Insert Task Below',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return TaskbookActions.insertBelow(current.taskbook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.selectAbove, {
    label: 'Select Task Above',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return TaskbookActions.selectAbove(current.taskbook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.selectBelow, {
    label: 'Select Task Below',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return TaskbookActions.selectBelow(current.taskbook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.extendAbove, {
    label: 'Extend Selection Above',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return TaskbookActions.extendSelectionAbove(current.taskbook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.extendBelow, {
    label: 'Extend Selection Below',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return TaskbookActions.extendSelectionBelow(current.taskbook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.commandMode, {
    label: 'Enter Command Mode',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        current.taskbook.mode = 'command';
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.editMode, {
    label: 'Enter Edit Mode',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        current.taskbook.mode = 'edit';
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.undoTaskAction, {
    label: 'Undo Task Operation',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return TaskbookActions.undo(current.taskbook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.redoTaskAction, {
    label: 'Redo Task Operation',
    execute: args => {
      const current = getCurrent(args);

      if (!current) {
        return TaskbookActions.redo(current.taskbook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.changeKernel, {
    label: 'Change Kernel',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return current.context.session.selectKernel();
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.reconnectToKernel, {
    label: 'Reconnect To Kernel',
    execute: args => {
      const current = getCurrent(args);

      if (!current) {
        return;
      }

      const kernel = current.context.session.kernel;

      if (kernel) {
        return kernel.reconnect();
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.createTaskView, {
    label: 'Create New View for Task',
    execute: args => {
      const current = getCurrent(args);
      const nb = current.taskbook;
      const newTask = nb.activeTask.clone();

      const TaskPanel = class extends Panel {
        protected onCloseRequest(msg: Message): void {
          this.dispose();
        }
      };
      const p = new TaskPanel();
      p.id = `Task-${uuid()}`;
      p.title.closable = true;
      p.title.label = current.title.label ? `Task: ${current.title.label}` : 'Task';
      p.addWidget(newTask);
      shell.addToMainArea(p);
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.createConsole, {
    label: 'Create Console for Taskbook',
    execute: args => {
      const current = getCurrent(args);
      const widget = tracker.currentWidget;

      if (!current || !widget) {
        return;
      }

      const options: ReadonlyJSONObject = {
        path: widget.context.path,
        preferredLanguage: widget.context.model.defaultKernelLanguage,
        activate: args['activate']
      };

      return commands.execute('console:create', options);
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.hideOutput, {
    label: 'Hide Output',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return TaskbookActions.hideOutput(current.taskbook);
      }
    },
    isEnabled
  });
  commands.addCommand(CommandIDs.showAllOutputs, {
    label: 'Show All Outputs',
    execute: args => {
      const current = getCurrent(args);

      if (current) {
        return TaskbookActions.showAllOutputs(current.taskbook);
      }
    },
    isEnabled
  });
}


/**
 * Populate the application's command palette with taskbook commands.
 */
function populatePalette(palette: ICommandPalette): void {
  let category = 'Taskbook Operations';
  [
    CommandIDs.interrupt,
    CommandIDs.restart,
    CommandIDs.restartClear,
    CommandIDs.restartRunAll,
    CommandIDs.runAll,
    CommandIDs.clearAllOutputs,
    CommandIDs.toggleAllLines,
    CommandIDs.editMode,
    CommandIDs.commandMode,
    CommandIDs.changeKernel,
    CommandIDs.reconnectToKernel,
    CommandIDs.createConsole,
    CommandIDs.closeAndShutdown,
    CommandIDs.trust
  ].forEach(command => { palette.addItem({ command, category }); });

  EXPORT_TO_FORMATS.forEach(exportToFormat => {
    let args = { 'format': exportToFormat['format'], 'label': exportToFormat['label'], 'isPalette': true };
    palette.addItem({ command: CommandIDs.exportToFormat, category: category, args: args });
  });

  category = 'Taskbook Task Operations';
  [
    CommandIDs.run,
    CommandIDs.runAndAdvance,
    CommandIDs.runAndInsert,
    CommandIDs.clearOutputs,
    CommandIDs.toCode,
    CommandIDs.toMarkdown,
    CommandIDs.toRaw,
    CommandIDs.cut,
    CommandIDs.copy,
    CommandIDs.paste,
    CommandIDs.deleteTask,
    CommandIDs.split,
    CommandIDs.merge,
    CommandIDs.insertAbove,
    CommandIDs.insertBelow,
    CommandIDs.selectAbove,
    CommandIDs.selectBelow,
    CommandIDs.extendAbove,
    CommandIDs.extendBelow,
    CommandIDs.moveDown,
    CommandIDs.moveUp,
    CommandIDs.undoTaskAction,
    CommandIDs.redoTaskAction,
    CommandIDs.markdown1,
    CommandIDs.markdown2,
    CommandIDs.markdown3,
    CommandIDs.markdown4,
    CommandIDs.markdown5,
    CommandIDs.markdown6,
    CommandIDs.hideCode,
    CommandIDs.showCode,
    CommandIDs.hideAllCode,
    CommandIDs.showAllCode,
    CommandIDs.hideOutput,
    CommandIDs.showOutput,
    CommandIDs.hideAllOutputs,
    CommandIDs.showAllOutputs,
  ].forEach(command => { palette.addItem({ command, category }); });
}


/**
 * Populates the application menus for the taskbook.
 */
function populateMenus(app: JupyterLab, mainMenu: IMainMenu, tracker: ITaskbookTracker): void {
  let { commands } = app;

  // Add undo/redo hooks to the edit menu.
  mainMenu.editMenu.undoers.add({
    tracker,
    undo: widget => { widget.taskbook.activeTask.editor.undo(); },
    redo: widget => { widget.taskbook.activeTask.editor.redo(); }
  } as IEditMenu.IUndoer<TaskbookPanel>);


  // Add new taskbook creation to the file menu.
  mainMenu.fileMenu.newMenu.addItem({ command: CommandIDs.createNew });

  // Add a close and shutdown command to the file menu.
  mainMenu.fileMenu.closeAndCleaners.add({
    tracker,
    action: 'Shutdown',
    closeAndCleanup: (current: TaskbookPanel) => {
      const fileName = current.title.label;
      return showDialog({
        title: 'Shutdown the taskbook?',
        body: `Are you sure you want to close "${fileName}"?`,
        buttons: [Dialog.cancelButton(), Dialog.warnButton()]
      }).then(result => {
        if (result.button.accept) {
          return current.context.session.shutdown()
            .then(() => { current.dispose(); });
        }
      });
    }
  } as IFileMenu.ICloseAndCleaner<TaskbookPanel>);

  // Add a taskbook group to the File menu.
  let exportTo = new Menu({ commands } );
  exportTo.title.label = 'Export to ...';
  EXPORT_TO_FORMATS.forEach(exportToFormat => {
    exportTo.addItem({ command: CommandIDs.exportToFormat, args: exportToFormat });
  });
  const fileGroup = [
    { command: CommandIDs.trust },
    { type: 'submenu', submenu: exportTo } as Menu.IItemOptions
  ];
  mainMenu.fileMenu.addGroup(fileGroup, 10);

  // Add a kernel user to the Kernel menu
  mainMenu.kernelMenu.kernelUsers.add({
    tracker,
    interruptKernel: current => {
      let kernel = current.session.kernel;
      if (kernel) {
        return kernel.interrupt();
      }
      return Promise.resolve(void 0);
    },
    restartKernel: current => current.session.restart(),
    changeKernel: current => current.session.selectKernel(),
    shutdownKernel: current => current.session.shutdown(),
  } as IKernelMenu.IKernelUser<TaskbookPanel>);

  // Add a console creator the the Kernel menu
  mainMenu.kernelMenu.consoleCreators.add({
    tracker,
    createConsole: current => {
      const options: ReadonlyJSONObject = {
        path: current.context.path,
        preferredLanguage: current.context.model.defaultKernelLanguage
      };
      return commands.execute('console:create', options);
    }
  } as IKernelMenu.IConsoleCreator<TaskbookPanel>);

  // Add some commands to the application view menu.
  const viewGroup = [
    CommandIDs.hideAllCode,
    CommandIDs.showAllCode,
    CommandIDs.hideAllOutputs,
    CommandIDs.showAllOutputs
  ].map(command => { return { command }; });
  mainMenu.viewMenu.addGroup(viewGroup, 10);

  // Add an IEditorViewer to the application view menu
  mainMenu.viewMenu.editorViewers.add({
    tracker,
    lineNumbersToggled: widget =>
      widget.taskbook.activeTask.editor.getOption('lineNumbers'),
    matchBracketsToggled: widget =>
      widget.taskbook.activeTask.editor.getOption('matchBrackets'),
  } as IViewMenu.IEditorViewer<TaskbookPanel>);

  // Add an ICodeRunner to the application run menu
  mainMenu.runMenu.codeRunners.add({
    tracker,
    noun: 'Task(s)',
    pluralNoun: 'Tasks',
    run: current => {
      const { context, taskbook } = current;
      return TaskbookActions.run(taskbook, context.session)
      .then(() => void 0);
    },
  } as IRunMenu.ICodeRunner<TaskbookPanel>);

  // Add commands to the application edit menu.
  const undoTaskActionGroup = [
    CommandIDs.undoTaskAction,
    CommandIDs.redoTaskAction
  ].map(command => { return { command }; });
  const editGroup = [
    CommandIDs.cut,
    CommandIDs.copy,
    CommandIDs.paste,
    CommandIDs.deleteTask,
    CommandIDs.split,
    CommandIDs.merge
  ].map(command => { return { command }; });
  mainMenu.editMenu.addGroup(undoTaskActionGroup, 4);
  mainMenu.editMenu.addGroup(editGroup, 5);
}
