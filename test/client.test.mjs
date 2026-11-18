import assert from "node:assert/strict";
import test from "node:test";

// The bundle registers itself with the client module loader as a side effect of
// evaluation, exactly as the DSH client does.
let definition;
globalThis.window = {
	__ModuleLoader__: {
		load(value) {
			definition = value;
		}
	}
};
await import(new URL("../lib/client.js", import.meta.url));
assert.equal(definition.id, "dsh-nav-shortcuts");

const plugin = definition.factory(() => {
	throw new Error("the bundle must not require external modules");
});
assert.equal(typeof plugin.apply, "function");

/**
 * Build one isolated client context: fake DSH services, a fake DOM, and the
 * commands the plugin registered against it.
 * @param {object} options - initial rows, current session, catalog and composer.
 * @returns the harness handle used by the tests below.
 */
function harness(options = {}) {
	const state = {
		rows: options.rows ?? [],
		current: options.current,
		sessions: options.sessions ?? { ids: [], byId: {} },
		composer: options.composer,
		opened: [],
		focused: []
	};
	globalThis.document = {
		querySelectorAll(selector) {
			if (selector.includes("data-row-key")) {
				return state.rows.map((key) => ({
					getAttribute: (name) => (name === "data-row-key" ? key : null)
				}));
			}
			if (selector.includes("data-composer-input")) return state.composer === undefined ? [] : [state.composer];
			return [];
		}
	};
	const commands = new Map();
	const shortcuts = {
		register(command) {
			commands.set(command.id, command);
			return () => commands.delete(command.id);
		}
	};
	plugin.apply({
		get(name) {
			switch (name) {
				case "shortcuts": return shortcuts;
				case "sessions": return { list: { getSnapshot: () => state.sessions } };
				case "workspaces": return { list: { getSnapshot: () => ({ archivedSessionIds: [] }) } };
				case "uiSession": return { adapter: { current: { getSnapshot: () => ({ key: state.current }) } } };
				case "uiWorkspace": return { openSession: (id) => state.opened.push(id) };
				default: return undefined;
			}
		},
		effect(factory) {
			return factory();
		}
	});
	return {
		state,
		commands,
		press(id) {
			const resolution = commands.get(id).resolve({ source: "keyboard", region: "page", modal: null, target: null });
			if (resolution.status !== "handled") return resolution;
			resolution.run();
			return resolution;
		}
	};
}

test("registers the three commands with Web defaults", () => {
	const { commands } = harness();
	assert.deepEqual([...commands.keys()].sort(), ["composer.focus", "session.next", "session.previous"]);
	assert.deepEqual(commands.get("session.next").defaults["web:windows"], { code: "ArrowDown", modifiers: ["primary", "alt"] });
	assert.deepEqual(commands.get("session.previous").defaults["web:windows"], { code: "ArrowUp", modifiers: ["primary", "alt"] });
	assert.deepEqual(commands.get("composer.focus").defaults["web:windows"], { code: "KeyI", modifiers: ["primary", "alt"] });
	// The desktop runtime reserves the arrow codes; no Linux desktop default may exist.
	assert.equal(commands.get("session.next").defaults["desktop:linux"], undefined);
	assert.equal(commands.get("session.previous").defaults["desktop:linux"], undefined);
});

test("steps through the sidebar's displayed order and wraps at both ends", () => {
	const { state, press } = harness({ rows: ["session:s1", "session:s9", "session:s3"], current: "s9" });
	press("session.next");
	assert.deepEqual(state.opened, ["s3"]);

	state.current = "s9";
	press("session.previous");
	assert.deepEqual(state.opened, ["s3", "s1"]);

	state.current = "s3";
	press("session.next");
	assert.equal(state.opened.at(-1), "s1");

	state.current = "s1";
	press("session.previous");
	assert.equal(state.opened.at(-1), "s3");
});

test("starts from an edge when the current session has no rendered row", () => {
	const { state, press } = harness({ rows: ["session:a", "session:b"], current: "collapsed" });
	press("session.next");
	press("session.previous");
	assert.deepEqual(state.opened, ["a", "b"]);
});

test("falls back to catalog order when no tree is rendered", () => {
	const { state, press } = harness({
		rows: [],
		current: "s2",
		sessions: {
			ids: ["s3", "s2", "s1", "s0"],
			byId: { s3: { blank: false }, s2: { blank: false }, s1: { blank: false }, s0: { blank: true } }
		}
	});
	press("session.next");
	assert.deepEqual(state.opened, ["s1"]);
});

test("focuses the composer's editor, and blocks when no composer is mounted", () => {
	const focused = [];
	const composer = {
		isConnected: true,
		getClientRects: () => [{}],
		closest: () => null,
		scrollIntoView: () => {},
		focus: () => focused.push("dom"),
		__lexicalEditor: { focus: () => focused.push("editor") }
	};
	const { press } = harness({ current: "s1", composer });
	assert.equal(press("composer.focus").status, "handled");
	assert.deepEqual(focused, ["editor"]);

	const empty = harness({ current: "s1" });
	assert.equal(empty.press("composer.focus").status, "blocked");
});
