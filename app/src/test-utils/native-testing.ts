import React, { ReactElement } from 'react';
import TestRenderer, { ReactTestInstance } from 'react-test-renderer';

// Minimal async util
export async function waitFor(cb: () => void, { timeout = 3000, interval = 30 } = {}) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      cb();
      return;
    } catch (e) {
      if (Date.now() - start > timeout) throw e;
      await new Promise((r) => setTimeout(r, interval));
    }
  }
}

// Minimal fireEvent supporting press & changeText
export const fireEvent = {
  press(node: any) {
    if (!node) throw new Error('fireEvent.press: target is undefined');
    const props = (node as any).props ?? {};
    if (typeof props.onPress === 'function') {
      props.onPress({});
      return;
    }
    throw new Error('fireEvent.press: target has no onPress handler');
  },
  changeText(node: any, value: string) {
    if (!node) throw new Error('fireEvent.changeText: target is undefined');
    const props = (node as any).props ?? {};
    if (typeof props.onChangeText === 'function') {
      props.onChangeText(value);
      return;
    }
    throw new Error('fireEvent.changeText: target has no onChangeText handler');
  },
};

// Tree search helpers
function textOf(node: ReactTestInstance): string | null {
  const type = node.type as any;
  if (type === 'Text' || type?.displayName === 'Text') {
    if (typeof node.props?.children === 'string') return node.props.children;
    if (Array.isArray(node.props?.children)) {
      const flat = node.props.children.flat(Infinity);
      const s = flat.filter((c) => typeof c === 'string').join('');
      return s || null;
    }
  }
  return null;
}

function* walk(node: ReactTestInstance): Generator<ReactTestInstance> {
  yield node;
  for (const child of node.children) {
    if (typeof child === 'object' && child && 'children' in child) {
      yield* walk(child as ReactTestInstance);
    }
  }
}

function getByTextFrom(root: ReactTestInstance, text: string): ReactTestInstance {
  for (const node of walk(root)) {
    const t = textOf(node);
    if (t === text) return node;
  }
  throw new Error(`getByText: No node found with exact text "${text}"`);
}

function getByTestIdFrom(root: ReactTestInstance, testID: string): ReactTestInstance {
  for (const node of walk(root)) {
    if ((node.props as any)?.testID === testID) return node;
  }
  throw new Error(`getByTestId: No node found with testID "${testID}"`);
}

// Public API
export function render(ui: ReactElement) {
  const inst = TestRenderer.create(ui);
  const root = inst.root as ReactTestInstance;

  const queries = {
    getByText: (text: string) => getByTextFrom(root, text),
    getByTestId: (id: string) => getByTestIdFrom(root, id),
    // expose root instance in case tests want to inspect the tree
    root,
    unmount: () => inst.unmount(),
    update: (el: ReactElement) => inst.update(el),
  };

  // Also attach queries to a shared "screen" object so either style works
  (screen as any)._attach(queries);

  return queries;
}

// screen proxy (populates on render)
type ScreenQueries = {
  getByText: (text: string) => ReactTestInstance;
  getByTestId: (id: string) => ReactTestInstance;
};
const _screen: Partial<ScreenQueries> = {};
export const screen: ScreenQueries = new Proxy({} as ScreenQueries, {
  get(_t, prop: keyof ScreenQueries) {
    if (!_screen[prop]) {
      throw new Error(
        `screen.${String(prop)} is not available yet. Call render(...) before using screen.`,
      );
    }
    return _screen[prop]!;
  },
}) as ScreenQueries;

(screen as any)._attach = (q: any) => {
  _screen.getByText = q.getByText;
  _screen.getByTestId = q.getByTestId;
};
