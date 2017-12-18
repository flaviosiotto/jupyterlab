// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import expect = require('expect.js');

import {
  CommandRegistry
} from '@phosphor/commands';

import {
  Widget
} from '@phosphor/widgets';

import {
  InstanceTracker
} from '@jupyterlab/apputils';

import {
  ViewMenu, IViewMenu
} from '@jupyterlab/mainmenu';

import {
  delegateExecute, delegateToggled
} from './util';

class Wodget extends Widget {
  wrapped: boolean = false;
  matched: boolean = false;
  numbered: boolean = false;
}

describe('@jupyterlab/mainmenu', () => {

  describe('ViewMenu', () => {

    let commands: CommandRegistry;
    let menu: ViewMenu;
    let tracker: InstanceTracker<Wodget>;
    let wodget: Wodget;

    before(() => {
      commands = new CommandRegistry();
    });

    beforeEach(() => {
      wodget = new Wodget();
      menu = new ViewMenu({ commands });
      tracker = new InstanceTracker<Wodget>({ namespace: 'wodget' });
      tracker.add(wodget);
    });

    afterEach(() => {
      menu.dispose();
      tracker.dispose();
      wodget.dispose();
    });

    describe('#constructor()', () => {

      it('should construct a new view menu', () => {
        expect(menu).to.be.an(ViewMenu);
        expect(menu.menu.title.label).to.be('View');
      });

    });

    describe('#editorViewers', () => {

      it('should allow setting of an IEditorViewer', () => {
        const viewer: IViewMenu.IEditorViewer<Wodget> = {
          tracker,
          toggleLineNumbers: widget => {
            widget.numbered = !widget.numbered;
            return;
          },
          toggleMatchBrackets: widget => {
            widget.matched = !widget.matched;
            return;
          },
          toggleWordWrap: widget => {
            widget.wrapped = !widget.wrapped;
            return;
          },
          matchBracketsToggled: widget => widget.matched,
          lineNumbersToggled: widget => widget.numbered,
          wordWrapToggled: widget => widget.wrapped
        };
        menu.editorViewers.add(viewer);

        expect(delegateToggled(wodget, menu.editorViewers, 'matchBracketsToggled'))
        .to.be(false);
        expect(delegateToggled(wodget, menu.editorViewers, 'wordWrapToggled'))
        .to.be(false);
        expect(delegateToggled(wodget, menu.editorViewers, 'lineNumbersToggled'))
        .to.be(false);

        delegateExecute(wodget, menu.editorViewers, 'toggleLineNumbers');
        delegateExecute(wodget, menu.editorViewers, 'toggleMatchBrackets');
        delegateExecute(wodget, menu.editorViewers, 'toggleWordWrap');

        expect(delegateToggled(wodget, menu.editorViewers, 'matchBracketsToggled'))
        .to.be(true);
        expect(delegateToggled(wodget, menu.editorViewers, 'wordWrapToggled'))
        .to.be(true);
        expect(delegateToggled(wodget, menu.editorViewers, 'lineNumbersToggled'))
        .to.be(true);
      });

    });

  });

});
