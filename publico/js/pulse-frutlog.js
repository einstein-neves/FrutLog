/* Interface enhancements only: operational data stays with the existing API. */
document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  const role = document.body.dataset.consoleRole;
  const roles = { admin: 'Administração', engenheiro: 'Engenharia agronômica', tecnico: 'Operações de campo' };

  const brandTag = document.createElement('span');
  brandTag.className = 'pulse-brand-tag';
  brandTag.textContent = 'AGRO';
  sidebar.querySelector('.logo-area').append(brandTag);

  const menu = sidebar.querySelector('.menu');
  const menuLabel = document.createElement('p');
  menuLabel.className = 'pulse-menu-label';
  menuLabel.textContent = 'Gestão da propriedade';
  menu.before(menuLabel);

  sidebar.id = 'frutlog-sidebar';
  sidebar.querySelectorAll('.nav-link, .btn-logout').forEach(item => {
    const label = item.textContent.trim();
    item.setAttribute('aria-label', label);
    item.title = label;
    [...item.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).forEach(node => {
      const span = document.createElement('span');
      span.className = 'pulse-nav-text';
      node.replaceWith(span);
      span.append(node);
    });
  });
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'pulse-sidebar-toggle';
  toggle.setAttribute('aria-controls', sidebar.id);
  const toggleIcon = document.createElement('i');
  toggleIcon.setAttribute('aria-hidden', 'true');
  toggle.append(toggleIcon);
  sidebar.querySelector('.logo-area').append(toggle);
  const mobile = window.matchMedia('(max-width: 760px)');
  let collapsed = false;
  const content = document.querySelector('.conteudo-dashboard');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let contentAnimation;
  try { collapsed = localStorage.getItem('frutlog-sidebar-collapsed') === 'true'; } catch {}
  function updateSidebar(animate = false) {
    const previousLeft = animate && !mobile.matches ? content.getBoundingClientRect().left : null;
    contentAnimation?.cancel();
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    const label = collapsed ? 'Expandir menu lateral' : 'Minimizar menu lateral';
    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.title = label;
    toggleIcon.className = `fa-solid ${mobile.matches ? (collapsed ? 'fa-chevron-down' : 'fa-chevron-up') : (collapsed ? 'fa-chevron-right' : 'fa-chevron-left')}`;
    if (previousLeft !== null && !reducedMotion.matches && typeof content.animate === 'function') {
      // Change layout once, then animate only the composited transform.
      const offset = previousLeft - content.getBoundingClientRect().left;
      contentAnimation = content.animate([
        { transform: `translateX(${offset}px)` },
        { transform: 'translateX(0)' },
      ], { duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
    }
    window.dispatchEvent(new Event('resize'));
  }
  toggle.addEventListener('click', () => {
    collapsed = !collapsed;
    try { localStorage.setItem('frutlog-sidebar-collapsed', String(collapsed)); } catch {}
    updateSidebar(true);
  });
  mobile.addEventListener('change', () => updateSidebar());
  updateSidebar();

  const profile = document.createElement('div');
  profile.className = 'pulse-profile';
  const avatar = document.createElement('span');
  avatar.className = 'pulse-avatar';
  const details = document.createElement('div');
  const name = document.createElement('strong');
  const description = document.createElement('small');
  const session = FrutLog.obterSessao();
  name.textContent = session?.nome || 'FrutLog';
  avatar.textContent = name.textContent.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
  description.textContent = roles[role];
  details.append(name, description);
  profile.append(avatar, details);
  sidebar.querySelector('.sidebar-acoes').prepend(profile);

  const top = document.querySelector('.topo');
  const eyebrow = document.createElement('span');
  eyebrow.className = 'pulse-eyebrow';
  eyebrow.textContent = 'Central de operações agrícolas';
  top.prepend(eyebrow);
  const meta = document.createElement('div');
  meta.className = 'pulse-header-meta';
  const date = document.createElement('time');
  date.className = 'pulse-date';
  date.dateTime = new Date().toISOString();
  date.textContent = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Fortaleza' }).format(new Date());
  meta.append(date);
  top.append(meta);
});
