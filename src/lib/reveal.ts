// Shared by the server (the pre-paint inline script) and the client
// (RevealOnce), so it can't live in a "use client" module.

export const revealStorageKey = (key: string) => `tiebreak:revealed:${key}`;

/**
 * Inline script rendered right after the result card. Runs before first
 * paint on a full page load, so an unseen result starts from its first
 * frame instead of flashing the finished state.
 */
export function revealScript(elementId: string, key: string) {
  return `(function(){try{var k=${JSON.stringify(revealStorageKey(key))};if(localStorage.getItem(k))return;localStorage.setItem(k,"1");var el=document.getElementById(${JSON.stringify(elementId)});if(el)el.setAttribute("data-reveal","")}catch(e){}})()`;
}
