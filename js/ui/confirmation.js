function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function getConfirmationMarkup({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
} = {}) {
  return `
    <form method="dialog" class="confirmation-dialog__content">
      <h2 id="confirmation-title">${escapeHtml(title)}</h2>
      <p id="confirmation-message">${escapeHtml(message)}</p>
      <div class="confirmation-dialog__actions">
        <button class="secondary-button" type="button" data-confirm-cancel>${escapeHtml(cancelLabel)}</button>
        <button class="primary-button" type="button" data-confirm-accept>${escapeHtml(confirmLabel)}</button>
      </div>
    </form>
  `;
}

export function openConfirmationDialog(
  documentRoot,
  options,
  { onConfirm = () => {}, onCancel = () => {} } = {},
) {
  if (!documentRoot?.body || typeof documentRoot.createElement !== 'function') {
    throw new TypeError('Um documento compatível é obrigatório para a confirmação.');
  }

  const dialog = documentRoot.createElement('dialog');

  if (typeof dialog.showModal !== 'function' || typeof dialog.close !== 'function') {
    throw new TypeError('O navegador não oferece suporte ao diálogo de confirmação.');
  }

  dialog.className = 'confirmation-dialog';
  dialog.setAttribute('aria-labelledby', 'confirmation-title');
  dialog.setAttribute('aria-describedby', 'confirmation-message');
  dialog.innerHTML = getConfirmationMarkup(options);

  const cancel = () => {
    onCancel();
    dialog.close('cancel');
  };
  const confirm = () => {
    onConfirm();
    dialog.close('confirm');
  };

  dialog.querySelector('[data-confirm-cancel]').addEventListener('click', cancel);
  dialog.querySelector('[data-confirm-accept]').addEventListener('click', confirm);
  dialog.addEventListener('cancel', onCancel, { once: true });
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  documentRoot.body.append(dialog);
  dialog.showModal();

  return Object.freeze({ close: cancel, element: dialog });
}
