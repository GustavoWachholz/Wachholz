import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getConfirmationMarkup,
  openConfirmationDialog,
} from '../../js/ui/confirmation.js';

function createDocumentDouble() {
  const appended = [];

  class ButtonDouble {
    addEventListener(type, callback) {
      this[type] = callback;
    }

    click() {
      this.click?.();
    }
  }

  class DialogDouble {
    constructor() {
      this.acceptButton = new ButtonDouble();
      this.cancelButton = new ButtonDouble();
      this.listeners = new Map();
      this.attributes = new Map();
      this.removed = false;
      this.open = false;
    }

    setAttribute(name, value) {
      this.attributes.set(name, value);
    }

    querySelector(selector) {
      return selector === '[data-confirm-accept]'
        ? this.acceptButton
        : this.cancelButton;
    }

    addEventListener(type, callback) {
      this.listeners.set(type, callback);
    }

    showModal() {
      this.open = true;
    }

    close(value) {
      this.open = false;
      this.returnValue = value;
      this.listeners.get('close')?.();
    }

    remove() {
      this.removed = true;
    }
  }

  return {
    appended,
    body: {
      append(element) {
        appended.push(element);
      },
    },
    createElement(name) {
      assert.equal(name, 'dialog');
      return new DialogDouble();
    },
  };
}

describe('getConfirmationMarkup', () => {
  it('gera diálogo com ações explícitas e conteúdo escapado', () => {
    const markup = getConfirmationMarkup({
      title: '<b>Sair?</b>',
      message: 'Confirmar & encerrar',
      confirmLabel: 'Sim',
      cancelLabel: 'Não',
    });

    assert.match(markup, /method="dialog"/);
    assert.match(markup, /data-confirm-cancel/);
    assert.match(markup, /data-confirm-accept/);
    assert.match(markup, /&lt;b&gt;Sair\?&lt;\/b&gt;/);
    assert.match(markup, /Confirmar &amp; encerrar/);
  });
});

describe('openConfirmationDialog', () => {
  it('abre o diálogo nativo, confirma e remove o elemento', () => {
    const documentRoot = createDocumentDouble();
    let confirmations = 0;
    const result = openConfirmationDialog(
      documentRoot,
      { title: 'Sair?', message: 'Confirme.' },
      { onConfirm: () => { confirmations += 1; } },
    );

    assert.equal(result.element.open, true);
    assert.equal(documentRoot.appended.length, 1);
    result.element.acceptButton.click();
    assert.equal(confirmations, 1);
    assert.equal(result.element.returnValue, 'confirm');
    assert.equal(result.element.removed, true);
  });

  it('cancela sem executar a confirmação', () => {
    const documentRoot = createDocumentDouble();
    let cancellations = 0;
    const result = openConfirmationDialog(
      documentRoot,
      { title: 'Sair?', message: 'Confirme.' },
      { onCancel: () => { cancellations += 1; } },
    );

    result.close();

    assert.equal(cancellations, 1);
    assert.equal(result.element.returnValue, 'cancel');
  });

  it('rejeita documento incompatível', () => {
    assert.throws(
      () => openConfirmationDialog({}, { title: 'A', message: 'B' }),
      /documento compatível/i,
    );
  });
});
