/*-----------------------------------------------------------------------------
| Copyright (c) Jupyter Development Team.
| Distributed under the terms of the Modified BSD License.
|----------------------------------------------------------------------------*/

import {
  Widget
} from '@phosphor/widgets';


/**
 * The CSS class added to the task header.
 */
const TASK_HEADER_CLASS = 'jp-TaskHeader';

/**
 * The CSS class added to the task footer.
 */
const TASK_FOOTER_CLASS = 'jp-TaskFooter';


/**
 * The interface for a task header.
 */
export
interface ITaskHeader extends Widget {}


/**
 * Default implementation of a cell header.
 */
export
class TaskHeader extends Widget implements ITaskHeader {
  /**
   * Construct a new cell header.
   */
  constructor() {
    super();
    this.addClass(TASK_HEADER_CLASS);
  }

}


/**
 * The interface for a task footer.
 */
export
interface ITaskFooter extends Widget {}


/**
 * Default implementation of a task footer.
 */
export
class TaskFooter extends Widget implements ITaskFooter {
  /**
   * Construct a new cell footer.
   */
  constructor() {
    super();
    this.addClass(TASK_FOOTER_CLASS);
  }

}
