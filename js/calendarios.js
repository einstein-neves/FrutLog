document.addEventListener('DOMContentLoaded', () => {
  if (typeof flatpickr === 'undefined') return;
  document.querySelectorAll('input[type="date"]').forEach(input => {
    const labels = [...input.labels || []];
    const picker = flatpickr(input, {
      locale: 'pt',
      dateFormat: 'Y-m-d',
      altInput: true,
      altFormat: 'd/m/Y',
      monthSelectorType: 'static',
      ariaDateFormat: 'j F Y',
      disableMobile: true,
      allowInput: true,
      minDate: input.min || undefined,
      maxDate: input.max || undefined,
      onOpen(_, __, instance) {
        instance.set('minDate', input.min || undefined);
        instance.set('maxDate', input.max || undefined);
        instance.setDate(input.value || null, false);
      },
      onReady(_, __, instance) {
        instance.altInput.placeholder = 'dd/mm/aaaa';
        instance.altInput.required = input.required;
        if (labels.length) instance.altInput.setAttribute('aria-label', labels.map(label => label.textContent.trim()).join(' '));
        const actions = document.createElement('div');
        actions.className = 'calendar-actions';
        for (const [label, action] of [
          ['Limpar', () => { instance.clear(); instance.close(); }],
          ['Hoje', () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (instance.isEnabled(today)) { instance.setDate(today, true); instance.close(); }
          }],
        ]) {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = label;
          button.addEventListener('click', action);
          actions.append(button);
        }
        instance.calendarContainer.append(actions);
      },
    });
    input.form?.addEventListener('reset', () => {
      requestAnimationFrame(() => picker.setDate(input.value || null, false));
    });
  });
});
