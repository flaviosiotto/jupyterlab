// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  KernelMessage
} from '@jupyterlab/services';

import {
  IClientSession, Clipboard, Dialog, showDialog
} from '@jupyterlab/apputils';

import {
  tbformat
} from '@jupyterlab/taskbookutils';

import {
  ITaskModel, IDataintegrationTaskModel,
  Task, DataintegrationTask, NotebookcellTask
} from '@jupyterlab/tasks';

import {
  ArrayExt, each, toArray
} from '@phosphor/algorithm';

import {
  ElementExt
} from '@phosphor/domutils';

import {
  h
} from '@phosphor/virtualdom';

import {
  ITaskbookModel
} from './model';

import {
  Taskbook
} from './widget';


// The message to display to the user when prompting to trust the Taskbook.
const TRUST_MESSAGE = h.p(
  'A trusted Jupyter Taskbook may execute hidden malicious code when you ',
  'open it.',
  h.br(),
  'Selecting trust will re-render this Taskbook in a trusted state.',
  h.br(),
  'For more information, see the',
  h.a({ href: 'https://jupyter-Taskbook.readthedocs.io/en/stable/security.html' },
      'Jupyter security documentation'),
);


/**
 * The mimetype used for Jupyter Task data.
 */
const JUPYTER_TASK_MIME = 'application/vnd.jupyter.Tasks';


/**
 * A namespace for handling actions on a Taskbook.
 *
 * #### Notes
 * All of the actions are a no-op if there is no model on the Taskbook.
 * The actions set the widget `mode` to `'command'` unless otherwise specified.
 * The actions will preserve the selection on the Taskbook widget unless
 * otherwise specified.
 */
export
namespace TaskbookActions {
  /**
   * Split the active Task into two Tasks.
   *
   * @param widget - The target Taskbook widget.
   *
   * #### Notes
   * It will preserve the existing mode.
   * The second Task will be activated.
   * The existing selection will be cleared.
   * The leading whitespace in the second Task will be removed.
   * If there is no content, two empty Tasks will be created.
   * Both Tasks will have the same type as the original Task.
   * This action can be undone.
   */
  export
  function splitTask(widget: Taskbook): void {
    if (!widget.model || !widget.activeTask) {
      return;
    }
    let state = Private.getState(widget);
    widget.deselectAll();
    let tbModel = widget.model;
    let index = widget.activeTaskIndex;
    let child = widget.widgets[index];
    let editor = child.editor;
    let position = editor.getCursorPosition();
    let offset = editor.getOffsetAt(position);
    let orig = child.model.value.text;

    // Create new models to preserve history.
    let clone0 = Private.cloneTask(tbModel, child.model);
    let clone1 = Private.cloneTask(tbModel, child.model);
    if (clone0.type === 'Dataintegration') {
      (clone0 as IDataintegrationTaskModel).outputs.clear();
    }
    clone0.value.text = orig.slice(0, offset).replace(/^\n+/, '').replace(/\n+$/, '');
    clone1.value.text = orig.slice(offset).replace(/^\n+/, '').replace(/\n+$/, '');

    // Make the changes while preserving history.
    let Tasks = tbModel.tasks;
    Tasks.beginCompoundOperation();
    Tasks.set(index, clone0);
    Tasks.insert(index + 1, clone1);
    Tasks.endCompoundOperation();

    widget.activeTaskIndex++;
    Private.handleState(widget, state);
  }

  /**
   * Delete the selected Tasks.
   *
   * @param widget - The target Taskbook widget.
   *
   * #### Notes
   * The Task after the last selected Task will be activated.
   * It will add a code Task if all Tasks are deleted.
   * This action can be undone.
   */
  export
  function deleteTasks(widget: Taskbook): void {
    if (!widget.model || !widget.activeTask) {
      return;
    }
    let state = Private.getState(widget);
    Private.deleteTasks(widget);
    Private.handleState(widget, state);
  }

  /**
   * Insert a new code Task above the active Task.
   *
   * @param widget - The target Taskbook widget.
   *
   * #### Notes
   * The widget mode will be preserved.
   * This action can be undone.
   * The existing selection will be cleared.
   * The new Task will the active Task.
   */
  export
  function insertAbove(widget: Taskbook): void {
    if (!widget.model || !widget.activeTask) {
      return;
    }
    let state = Private.getState(widget);
    let model = widget.model;
    let task = model.contentFactory.createDataintegrationTask({ });
    let index = widget.activeTaskIndex;
    model.tasks.insert(index, task);
    // Make the newly inserted Task active.
    widget.activeTaskIndex = index;
    widget.deselectAll();
    Private.handleState(widget, state, true);
  }

  /**
   * Insert a new code Task below the active Task.
   *
   * @param widget - The target Taskbook widget.
   *
   * #### Notes
   * The widget mode will be preserved.
   * This action can be undone.
   * The existing selection will be cleared.
   * The new Task will be the active Task.
   */
  export
  function insertBelow(widget: Taskbook): void {
    if (!widget.model || !widget.activeTask) {
      return;
    }
    let state = Private.getState(widget);
    let model = widget.model;
    let task = model.contentFactory.createDataintegrationTask({});
    model.tasks.insert(widget.activeTaskIndex + 1, task);
    // Make the newly inserted Task active.
    widget.activeTaskIndex++;
    widget.deselectAll();
    Private.handleState(widget, state, true);
  }

  /**
   * Change the selected Task type(s).
   *
   * @param widget - The target Taskbook widget.
   *
   * @param value - The target Task type.
   *
   * #### Notes
   * It should preserve the widget mode.
   * This action can be undone.
   * The existing selection will be cleared.
   * Any Tasks converted to markdown will be unrendered.
   */
  export
  function changeTaskType(widget: Taskbook, value: tbformat.TaskType): void {
    if (!widget.model || !widget.activeTask) {
      return;
    }
    let state = Private.getState(widget);
    Private.changeTaskType(widget, value);
    Private.handleState(widget, state);
  }

  /**
   * Run the selected Task(s).
   *
   * @param widget - The target taskbook widget.
   *
   * @param session - The optional client session object.
   *
   * #### Notes
   * The last selected Task will be activated, but not scrolled into view.
   * The existing selection will be cleared.
   * An execution error will prevent the remaining code Tasks from executing.
   * All markdown Tasks will be rendered.
   */
  export
  function run(widget: Taskbook, session?: IClientSession): Promise<boolean> {
    if (!widget.model || !widget.activeTask) {
      return Promise.resolve(false);
    }
    let state = Private.getState(widget);
    let promise = Private.runSelected(widget, session);
    Private.handleRunState(widget, state, false);
    return promise;
  }

  /**
   * Run all of the Tasks in the Taskbook.
   *
   * @param widget - The target Taskbook widget.
   *
   * @param session - The optional client session object.
   *
   * #### Notes
   * The existing selection will be cleared.
   * An execution error will prevent the remaining code Tasks from executing.
   * All markdown Tasks will be rendered.
   * The last Task in the Taskbook will be activated and scrolled into view.
   */
  export
  function runAll(widget: Taskbook, session?: IClientSession): Promise<boolean> {
    if (!widget.model || !widget.activeTask) {
      return Promise.resolve(false);
    }
    let state = Private.getState(widget);
    each(widget.widgets, child => {
      widget.select(child);
    });
    let promise = Private.runSelected(widget, session);
    Private.handleRunState(widget, state, true);
    return promise;
  }

  /**
   * Select the above the active Task.
   *
   * @param widget - The target Taskbook widget.
   *
   * #### Notes
   * The widget mode will be preserved.
   * This is a no-op if the first Task is the active Task.
   * The existing selection will be cleared.
   */
  export
  function selectAbove(widget: Taskbook): void {
    if (!widget.model || !widget.activeTask) {
      return;
    }
    if (widget.activeTaskIndex === 0) {
      return;
    }
    let state = Private.getState(widget);
    widget.activeTaskIndex -= 1;
    widget.deselectAll();
    Private.handleState(widget, state, true);
  }

  /**
   * Select the Task below the active Task.
   *
   * @param widget - The target Taskbook widget.
   *
   * #### Notes
   * The widget mode will be preserved.
   * This is a no-op if the last Task is the active Task.
   * The existing selection will be cleared.
   */
  export
  function selectBelow(widget: Taskbook): void {
    if (!widget.model || !widget.activeTask) {
      return;
    }
    if (widget.activeTaskIndex === widget.widgets.length - 1) {
      return;
    }
    let state = Private.getState(widget);
    widget.activeTaskIndex += 1;
    widget.deselectAll();
    Private.handleState(widget, state, true);
  }

  /**
   * Extend the selection to the Task above.
   *
   * @param widget - The target Taskbook widget.
   *
   * #### Notes
   * This is a no-op if the first Task is the active Task.
   * The new Task will be activated.
   */
  export
  function extendSelectionAbove(widget: Taskbook): void {
    if (!widget.model || !widget.activeTask) {
      return;
    }
    // Do not wrap around.
    if (widget.activeTaskIndex === 0) {
      return;
    }
    let state = Private.getState(widget);
    widget.mode = 'command';
    let current = widget.activeTask;
    let prev = widget.widgets[widget.activeTaskIndex - 1];
    if (widget.isSelected(prev)) {
      widget.deselect(current);
      if (widget.activeTaskIndex > 1) {
        let prevPrev = widget.widgets[widget.activeTaskIndex - 2];
        if (!widget.isSelected(prevPrev)) {
          widget.deselect(prev);
        }
      }
    } else {
      widget.select(current);
    }
    widget.activeTaskIndex -= 1;
    Private.handleState(widget, state, true);
  }

  /**
   * Extend the selection to the Task below.
   *
   * @param widget - The target Taskbook widget.
   *
   * #### Notes
   * This is a no-op if the last Task is the active Task.
   * The new Task will be activated.
   */
  export
  function extendSelectionBelow(widget: Taskbook): void {
    if (!widget.model || !widget.activeTask) {
      return;
    }
    // Do not wrap around.
    if (widget.activeTaskIndex === widget.widgets.length - 1) {
      return;
    }
    let state = Private.getState(widget);
    widget.mode = 'command';
    let current = widget.activeTask;
    let next = widget.widgets[widget.activeTaskIndex + 1];
    if (widget.isSelected(next)) {
      widget.deselect(current);
      if (widget.activeTaskIndex < widget.model.tasks.length - 2) {
        let nextNext = widget.widgets[widget.activeTaskIndex + 2];
        if (!widget.isSelected(nextNext)) {
          widget.deselect(next);
        }
      }
    } else {
      widget.select(current);
    }
    widget.activeTaskIndex += 1;
    Private.handleState(widget, state, true);
  }

  /**
   * Copy the selected Task data to a clipboard.
   *
   * @param widget - The target Taskbook widget.
   */
  export
  function copy(widget: Taskbook): void {
    Private.copyOrCut(widget, false);
  }

  /**
   * Cut the selected Task data to a clipboard.
   *
   * @param widget - The target Taskbook widget.
   *
   * #### Notes
   * This action can be undone.
   * A new code Task is added if all Tasks are cut.
   */
  export
  function cut(widget: Taskbook): void {
    Private.copyOrCut(widget, true);
  }

  /**
   * Paste Tasks from the application clipboard.
   *
   * @param widget - The target Taskbook widget.
   *
   * #### Notes
   * The Tasks are pasted below the active Task.
   * The last pasted Task becomes the active Task.
   * This is a no-op if there is no Task data on the clipboard.
   * This action can be undone.
   */
  export
  function paste(widget: Taskbook): void {
    if (!widget.model || !widget.activeTask) {
      return;
    }
    let clipboard = Clipboard.getInstance();
    if (!clipboard.hasData(JUPYTER_TASK_MIME)) {
      return;
    }
    let state = Private.getState(widget);
    let values = clipboard.getData(JUPYTER_TASK_MIME) as tbformat.IBaseTask[];
    let model = widget.model;
    let newTasks: ITaskModel[] = [];
    widget.mode = 'command';

    each(values, task => {
      switch (task.Task_type) {
      case 'Dataintegration':
        newTasks.push(model.contentFactory.createDataintegrationTask({ task }));
        break;
      case 'Notebookcell':
        newTasks.push(model.contentFactory.createNotebookcellTask({ }));
        break;
      }
    });
    let index = widget.activeTaskIndex;

    let tasks = widget.model.tasks;
    tasks.beginCompoundOperation();
    each(newTasks, Task => {
      tasks.insert(++index, Task);
    });
    tasks.endCompoundOperation();

    widget.activeTaskIndex += newTasks.length;
    widget.deselectAll();
    Private.handleState(widget, state);
  }

  /**
   * Undo a Task action.
   *
   * @param widget - The target Taskbook widget.
   *
   * #### Notes
   * This is a no-op if if there are no Task actions to undo.
   */
  export
  function undo(widget: Taskbook): void {
    if (!widget.model || !widget.activeTask) {
      return;
    }
    let state = Private.getState(widget);
    widget.mode = 'command';
    widget.model.tasks.undo();
    widget.deselectAll();
    Private.handleState(widget, state);
  }

  /**
   * Redo a Task action.
   *
   * @param widget - The target Taskbook widget.
   *
   * #### Notes
   * This is a no-op if there are no Task actions to redo.
   */
  export
  function redo(widget: Taskbook): void {
    if (!widget.model || !widget.activeTask) {
      return;
    }
    let state = Private.getState(widget);
    widget.mode = 'command';
    widget.model.tasks.redo();
    widget.deselectAll();
    Private.handleState(widget, state);
  }

  /**
   * Hide the output on selected code Tasks.
   *
   * @param widget - The target Taskbook widget.
   */
  export
  function hideOutput(widget: Taskbook): void {
    if (!widget.model || !widget.activeTask) {
      return;
    }
    let state = Private.getState(widget);
    let Tasks = widget.widgets;
    each(Tasks, (Task: Task) => {
      if (widget.isSelected(Task)) {
        (Task as DataintegrationTask).inputHidden = true;
      }
    });
    Private.handleState(widget, state);
  }

  /**
   * Show the output on all code Tasks.
   *
   * @param widget - The target Taskbook widget.
   */
  export
  function showAllOutputs(widget: Taskbook): void {
    if (!widget.model || !widget.activeTask) {
      return;
    }
    let state = Private.getState(widget);
    let Tasks = widget.widgets;
    each(Tasks, (Task: Task) => {
      (Task as DataintegrationTask).outputHidden = false;
    });
    Private.handleState(widget, state);
  }

  /**
   * Trust the Taskbook after prompting the user.
   *
   * @param widget - The target Taskbook widget.
   *
   * @returns a promise that resolves when the transaction is finished.
   *
   * #### Notes
   * No dialog will be presented if the Taskbook is already trusted.
   */
  export
  function trust(widget: Taskbook): Promise<void> {
    if (!widget.model) {
      return Promise.resolve(void 0);
    }
    // Do nothing if already trusted.
    let tasks = widget.model.tasks;
    let trusted = true;
    for (let i = 0; i < tasks.length; i++) {
      let task = tasks.get(i);
      if (!task.trusted) {
        trusted = false;
      }
    }
    if (trusted) {
      return showDialog({
        body: 'Taskbook is already trusted',
        buttons: [Dialog.okButton()]
      }).then(() => void 0);
    }
    return showDialog({
      body: TRUST_MESSAGE,
      title: 'Trust this Taskbook?',
      buttons: [Dialog.cancelButton(), Dialog.warnButton()]
    }).then(result => {
      if (result.button.accept) {
        for (let i = 0; i < tasks.length; i++) {
          let task = tasks.get(i);
          task.trusted = true;
        }
      }
    });
  }
}


/**
 * A namespace for private data.
 */
namespace Private {
  /**
   * The interface for a widget state.
   */
  export
  interface IState {
    /**
     * Whether the widget had focus.
     */
    wasFocused: boolean;

    /**
     * The active Task before the action.
     */
    activeTask: Task;
  }

  /**
   * Get the state of a widget before running an action.
   */
  export
  function getState(widget: Taskbook): IState {
    return {
      wasFocused: widget.node.contains(document.activeElement),
      activeTask: widget.activeTask
    };
  }

  /**
   * Handle the state of a widget after running an action.
   */
  export
  function handleState(widget: Taskbook, state: IState, scrollIfNeeded=false): void {
    if (state.wasFocused || widget.mode === 'edit') {
      widget.activate();
    }
    if (scrollIfNeeded) {
      ElementExt.scrollIntoViewIfNeeded(widget.node, widget.activeTask.node);
    }
  }

  /**
   * Handle the state of a widget after running a run action.
   */
  export
  function handleRunState(widget: Taskbook, state: IState, scroll = false): void {
    if (state.wasFocused || widget.mode === 'edit') {
      widget.activate();
    }
    if (scroll) {
      // Scroll to the top of the previous active Task output.
      let er = state.activeTask.inputArea.node.getBoundingClientRect();
      widget.scrollToPosition(er.bottom);
    }
  }

  /**
   * Clone a Task model.
   */
  export
  function cloneTask(model: ITaskbookModel, task: ITaskModel): ITaskModel {
    switch (task.type) {
    case 'Dataintegration':
      // TODO why isnt modeldb or id passed here?
      return model.contentFactory.createDataintegrationTask({ task: task.toJSON() });
    case 'Notebookcell':
      // TODO why isnt modeldb or id passed here?
      return model.contentFactory.createNotebookcellTask({ task: task.toJSON() });
    }
  }

  /**
   * Run the selected Tasks.
   */
  export
  function runSelected(widget: Taskbook, session?: IClientSession): Promise<boolean> {
    widget.mode = 'command';
    let selected: Task[] = [];
    let lastIndex = widget.activeTaskIndex;
    let i = 0;
    each(widget.widgets, child => {
      if (widget.isSelected(child)) {
        selected.push(child);
        lastIndex = i;
      }
      i++;
    });
    widget.activeTaskIndex = lastIndex;
    widget.deselectAll();

    let promises: Promise<boolean>[] = [];
    each(selected, child => {
      promises.push(runTask(widget, child, session));
    });
    return Promise.all(promises).then(results => {
      if (widget.isDisposed) {
        return false;
      }
      // Post an update request.
      widget.update();
      for (let result of results) {
        if (!result) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Run a Task.
   */
  function runTask(parent: Taskbook, child: Task, session?: IClientSession): Promise<boolean> {
    switch (child.model.type) {
    case 'Notebookcell':
      (child as NotebookcellTask).rendered = true;
      child.inputHidden = false;
      break;
    case 'Dataintegration':
      if (session) {
        return DataintegrationTask.execute(child as DataintegrationTask, session).then(reply => {
          if (child.isDisposed) {
            return false;
          }
          if (reply && reply.content.status === 'ok') {
            let content = reply.content as KernelMessage.IExecuteOkReply;
            if (content.payload && content.payload.length) {
              handlePayload(content, parent, child);
            }
          }
          return reply ? reply.content.status === 'ok' : true;
        });
      }
      (child.model as IDataintegrationTaskModel).executionCount = null;
      break;
    default:
      break;
    }
    return Promise.resolve(true);
  }

  /**
   * Handle payloads from an execute reply.
   *
   * #### Notes
   * Payloads are deprecated and there are no official interfaces for them in
   * the kernel type definitions.
   * See [Payloads (DEPRECATED)](https://jupyter-client.readthedocs.io/en/latest/messaging.html#payloads-deprecated).
   */
  function handlePayload(content: KernelMessage.IExecuteOkReply, parent: Taskbook, child: Task) {
    let setNextInput = content.payload.filter(i => {
      return (i as any).source === 'set_next_input';
    })[0];

    if (!setNextInput) {
      return;
    }

    let text = (setNextInput as any).text;
    let replace = (setNextInput as any).replace;

    if (replace) {
      child.model.value.text = text;
      return;
    }

    // Create a new code Task and add as the next Task.
    let Task = parent.model.contentFactory.createDataintegrationTask({});
    Task.value.text = text;
    let tasks = parent.model.tasks;
    let i = ArrayExt.firstIndexOf(toArray(tasks), child.model);
    if (i === -1) {
      tasks.push(Task);
    } else {
      tasks.insert(i + 1, Task);
    }
  }

  /**
   * Copy or cut the selected Task data to the application clipboard.
   *
   * @param widget - The target Taskbook widget.
   *
   * @param cut - Whether to copy or cut.
   */
   export
   function copyOrCut(widget: Taskbook, cut: boolean): void {
     if (!widget.model || !widget.activeTask) {
       return;
     }
     let state = getState(widget);
     widget.mode = 'command';
     let clipboard = Clipboard.getInstance();
     clipboard.clear();
     let data: tbformat.IBaseTask[] = [];
     each(widget.widgets, child => {
       if (widget.isSelected(child)) {
         data.push(child.model.toJSON());
       }
     });
     clipboard.setData(JUPYTER_TASK_MIME, data);
     if (cut) {
       deleteTasks(widget);
     } else {
       widget.deselectAll();
     }
     handleState(widget, state);
   }

  /**
   * Change the selected Task type(s).
   *
   * @param widget - The target Taskbook widget.
   *
   * @param value - The target Task type.
   *
   * #### Notes
   * It should preserve the widget mode.
   * This action can be undone.
   * The existing selection will be cleared.
   * Any Tasks converted to markdown will be unrendered.
   */
  export
  function changeTaskType(widget: Taskbook, value: tbformat.TaskType): void {
    let model = widget.model;
    let tasks = model.tasks;

    tasks.beginCompoundOperation();
    each(widget.widgets, (child, i) => {
      if (!widget.isSelected(child)) {
        return;
      }
      if (child.model.type !== value) {
        let task: tbformat.IBaseTask = child.model.toJSON();
        let newTask: ITaskModel;
        switch (value) {
        case 'Dataintegration':
          newTask = model.contentFactory.createDataintegrationTask({ task });
          break;
        case 'Notebookcell':
          newTask = model.contentFactory.createNotebookcellTask({ task });
          if (child.model.type === 'Dataintegration') {
            newTask.trusted = false;
          }
          break;
        }
        tasks.set(i, newTask);
      }
    });
    tasks.endCompoundOperation();
    widget.deselectAll();
  }

  /**
   * Delete the selected Tasks.
   *
   * @param widget - The target Taskbook widget.
   *
   * #### Notes
   * The Task after the last selected Task will be activated.
   * It will add a code Task if all Tasks are deleted.
   * This action can be undone.
   */
  export
  function deleteTasks(widget: Taskbook): void {
    let model = widget.model;
    let tasks = model.tasks;
    let toDelete: number[] = [];
    widget.mode = 'command';

    // Find the Tasks to delete.
    each(widget.widgets, (child, i) => {
      let deletable = child.model.metadata.get('deletable');
      if (widget.isSelected(child) && deletable !== false) {
        toDelete.push(i);
      }
    });

    // If Tasks are not deletable, we may not have anything to delete.
    if (toDelete.length > 0) {
      // Delete the Tasks as one undo event.
      tasks.beginCompoundOperation();
      each(toDelete.reverse(), i => {
        tasks.remove(i);
      });
      // Add a new Task if the Taskbook is empty. This is done
      // within the compound operation to make the deletion of
      // a Taskbook's last Task undoable.
      if (!tasks.length) {
        tasks.push(model.contentFactory.createDataintegrationTask({}));
      }
      tasks.endCompoundOperation();

      // Select the *first* interior Task not deleted or the Task
      // *after* the last selected Task.
      // Note: The activeTaskIndex is clamped to the available Tasks,
      // so if the last Task is deleted the previous Task will be activated.
      widget.activeTaskIndex = toDelete[0];
    }

    // Deselect any remaining, undeletable Tasks. Do this even if we don't
    // delete anything so that users are aware *something* happened.
    widget.deselectAll();
  }

  /**
   * Set the markdown header level of a Task.
   */
  export
  function setMarkdownHeader(Task: ITaskModel, level: number) {
    let source = Task.value.text;
    let newHeader = Array(level + 1).join('#') + ' ';
    // Remove existing header or leading white space.
    let regex = /^(#+\s*)|^(\s*)/;
    let matches = regex.exec(source);
    if (matches) {
      source = source.slice(matches[0].length);
    }
    Task.value.text = newHeader + source;
  }
}
