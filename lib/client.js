window.__ModuleLoader__.load({
	id: "dsh-nav-shortcuts",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		/**
		 * Browser-half services. The Cordis client loader waits for each of these
		 * before calling apply, so the commands below register against live services.
		 */
		const inject = ["shortcuts", "sessions", "uiWorkspace", "uiSession"];

		/**
		 * Read a snapshot store defensively; the owning plugin may be absent.
		 * @param {unknown} store - a client snapshot store.
		 * @returns the current snapshot, or undefined.
		 */
		function snapshotOf(store) {
			try {
				return store.getSnapshot();
			} catch {
				return undefined;
			}
		}

		/**
		 * Session ids in the order the left sidebar actually shows them.
		 *
		 * The sidebar renders only what is visible: collapsed Workspaces, rows
		 * beyond the per-Workspace watermark ("Show more"), subagent Sessions and
		 * the inactive archive filter leave no row in the DOM. Reading the rows in
		 * document order therefore yields exactly the displayed sequence, including
		 * manual ordering, grouping and nesting.
		 * @returns shown session ids, or an empty list when no tree is rendered.
		 */
		function displayedSessionIds() {
			const ids = [];
			for (const element of document.querySelectorAll('[data-row-key^="session:"]')) {
				const key = element.getAttribute("data-row-key");
				if (key === null || key.length <= 8) continue;
				ids.push(key.slice(8));
			}
			return ids;
		}

		/**
		 * Session ids in the same order the Session catalog lists them, minus the
		 * rows the sidebar hides: blank new Sessions, subagent Sessions, and
		 * archived Sessions. Fallback for when no tree is rendered — a collapsed
		 * sidebar rail, or the sidebar replaced by search results.
		 * @param ctx - client root context.
		 * @returns session ids, first-to-last catalog order.
		 */
		function catalogSessionIds(ctx) {
			const snapshot = snapshotOf(ctx.get("sessions").list);
			if (snapshot === undefined || !Array.isArray(snapshot.ids)) return [];
			const archived = new Set(snapshotOf(ctx.get("workspaces")?.list)?.archivedSessionIds ?? []);
			const ids = [];
			for (const id of snapshot.ids) {
				const row = snapshot.byId?.[id];
				if (row === undefined) continue;
				if (row.blank === true) continue;
				if (row.origin === "subagent") continue;
				if (row.parentId !== undefined) continue;
				if (archived.has(id)) continue;
				ids.push(id);
			}
			return ids;
		}

		/**
		 * The Session the main view currently shows.
		 * @param ctx - client root context.
		 * @returns its id, or undefined for the no-Session state.
		 */
		function currentSessionId(ctx) {
			return snapshotOf(ctx.get("uiSession")?.adapter?.current)?.key;
		}

		/**
		 * Resolve one step through the Session list and open the target.
		 * @param ctx - client root context.
		 * @param direction - 1 for the next Session, -1 for the previous one.
		 * @returns the shortcut resolution.
		 */
		function stepSession(ctx, direction) {
			const displayed = displayedSessionIds();
			const ids = displayed.length > 0 ? displayed : catalogSessionIds(ctx);
			if (ids.length === 0) return { status: "blocked", reason: "No sessions" };
			const current = currentSessionId(ctx);
			const index = current === undefined ? -1 : ids.indexOf(current);
			let next;
			if (index === -1) next = direction > 0 ? ids[0] : ids[ids.length - 1];
			else next = ids[(index + direction + ids.length) % ids.length];
			const workspace = ctx.get("uiWorkspace");
			if (workspace === undefined || typeof workspace.openSession !== "function") {
				return { status: "blocked", reason: "Session navigation unavailable" };
			}
			return {
				status: "handled",
				run: () => {
					workspace.openSession(next);
				}
			};
		}

		/**
		 * The composer's contenteditable host for the current Session, preferring a
		 * visible input inside that Conversation over any other resident composer.
		 * @param ctx - client root context.
		 * @returns the element, or undefined when no composer is mounted.
		 */
		function composerTarget(ctx) {
			const current = currentSessionId(ctx);
			const visible = Array.from(document.querySelectorAll("[data-composer-input]")).filter((element) => element.isConnected && element.getClientRects().length > 0);
			if (visible.length === 0) return undefined;
			const scoped = visible.find((element) => {
				const root = element.closest("[data-conversation-session]");
				return root !== null && root.getAttribute("data-conversation-session") === current;
			});
			return scoped ?? visible[0];
		}

		/**
		 * Move focus into the composer. Lexical exposes its editor on the root
		 * element; its own focus restores the draft selection, while a plain DOM
		 * focus is the fallback when that handle is absent.
		 * @param element - the composer contenteditable host.
		 */
		function focusComposerElement(element) {
			element.scrollIntoView({ block: "nearest" });
			const editor = element.__lexicalEditor;
			if (editor !== null && typeof editor === "object" && typeof editor.focus === "function") editor.focus();
			else element.focus();
		}

		/**
		 * Build a Session stepping command.
		 * @param ctx - client root context.
		 * @param id - stable command id.
		 * @param label - English label shown in the shortcut reference.
		 * @param aliases - extra search terms.
		 * @param code - physical key code.
		 * @param direction - 1 for next, -1 for previous.
		 * @returns the command descriptor for `shortcuts.register`.
		 */
		function stepCommand(ctx, id, label, aliases, code, direction) {
			const binding = () => ({ code, modifiers: ["primary", "alt"] });
			return {
				id,
				label: () => label,
				aliases,
				// No web:linux and no desktop:linux: that runtime reserves the arrow
				// codes, and a rejected default throws for the whole command.
				defaults: {
					"web:windows": binding(),
					"web:macos": binding(),
					"desktop:windows": binding(),
					"desktop:macos": binding()
				},
				regions: ["page", "editable"],
				modals: [],
				resolve: () => stepSession(ctx, direction)
			};
		}

		/**
		 * Register the Session navigation and composer focus commands.
		 * @param ctx - client root context with the shortcuts service available.
		 */
		function apply(ctx) {
			const shortcuts = ctx.get("shortcuts");
			if (shortcuts === undefined || typeof shortcuts.register !== "function") {
				console.warn("[dsh-nav-shortcuts] shortcut service unavailable; no commands registered");
				return;
			}
			const binding = () => ({ code: "KeyI", modifiers: ["primary", "alt"] });
			const commands = [
				stepCommand(ctx, "session.next", "Next session", ["next session", "next chat", "下一个会话", "下一个对话"], "ArrowDown", 1),
				stepCommand(ctx, "session.previous", "Previous session", ["previous session", "prev session", "上一个会话", "上一个对话"], "ArrowUp", -1),
				{
					id: "composer.focus",
					label: () => "Focus message input",
					aliases: ["focus composer", "focus input", "聚焦输入框", "聚焦输入"],
					defaults: {
						"web:windows": binding(),
						"web:macos": binding(),
						"desktop:windows": binding(),
						"desktop:macos": binding(),
						"desktop:linux": binding()
					},
					regions: ["page", "editable", "terminal"],
					modals: [],
					resolve: () => {
						const target = composerTarget(ctx);
						if (target === undefined) return { status: "blocked", reason: "No message input" };
						return {
							status: "handled",
							run: () => {
								focusComposerElement(target);
							}
						};
					}
				}
			];
			ctx.effect(() => {
				const disposers = [];
				for (const command of commands) {
					try {
						disposers.push(shortcuts.register(command));
					} catch (error) {
						console.error(`[dsh-nav-shortcuts] could not register ${command.id}: ${error instanceof Error ? error.message : String(error)}`);
					}
				}
				return () => {
					for (const dispose of disposers) {
						try {
							dispose();
						} catch {
							/* the owner is already gone */
						}
					}
				};
			}, "dsh-nav-shortcuts: commands");
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
