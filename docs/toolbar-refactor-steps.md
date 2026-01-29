# Toolbar Refactor Recovery Plan

1. **Start from clean slate** – revert `src/app.ts` back to the committed baseline so we avoid working on a partially edited file. Confirm the basic layout (Appearance panel, Export panel, existing controls) is untouched before continuing, and take a short note of the diff before making structural edits so we can restore it if needed.

2. **Rebuild toolbar structure incrementally** – reintroduce the grouped toolbar layout from earlier (text style, lists, insert, layout, export groups) and ensure the second redundant toolbar block is not present. Keep the font, dropdowns, and status line in a single toolbar area above the editor.

3. **Implement dropdown controls + modals carefully** – wire up dropdown buttons for typography, margin/padding, and export options, including the “Custom…” modal prompt, but do it one section at a time to avoid deleting large chunks of markup. Keep the original input references available until the new controls are fully wired, and validate each dropdown in-browser before moving to the next to catch missing HTML/CSS before they accumulate.

4. **Update styles systematically** – adjust `src/style.css` to meet the new Material-inspired design (2px rounded borders, grouped backgrounds, hover-only separation for grid buttons, Font label, text-size icon, etc.), changing CSS incrementally so visual regression is easy to verify.

5. **Address remaining requests** – convert the heading dropdown into six dedicated buttons plus a paragraph button, add “None” options to margin/padding menus, replace the advanced-pages dropdown with the labeled checkbox, and add the Advanced Settings foldout placeholder.

6. **Verify wiring + cleanup** – once markup and styles are set, ensure all buttons still call the correct handlers, remove any leftover duplicate elements, and confirm the toolbar runs without errors before resuming implementation.

Once these steps are documented, hold off on further edits until the next instruction, and rerun `git status` after each chunk so you can detect and revert any accidental mass deletions before they spread.
