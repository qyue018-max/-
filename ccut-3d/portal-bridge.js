(function installCampusPortalBridge() {
  if (window.parent === window) return;

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || document.pointerLockElement) return;
    window.parent.postMessage({ type: 'ccut-campus-exit' }, '*');
  });
}());
