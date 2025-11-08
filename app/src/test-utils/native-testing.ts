import { act, create } from 'react-test-renderer';
import type { ReactElement } from 'react';

type WaitForOptions = {
  interval?: number;
  timeout?: number;
};

let currentInstance: ReturnType<typeof create> | null = null;

export function render(element: ReactElement) {
  act(() => {
    currentInstance = create(element);
  });

  return {
    rerender(next: ReactElement) {
      if (!currentInstance) return;
      act(() => {
        currentInstance.update(next);
      });
    },
    unmount() {
      act(() => {
        currentInstance?.unmount();
        currentInstance = null;
      });
    },
  };
}

function requireRoot() {
  if (!currentInstance) {
    throw new Error('render() must be called before accessing screen');
  }
  return currentInstance.root;
}

export const screen = {
  getByTestId(testID: string) {
    return requireRoot().findByProps({ testID });
  },
};

export const fireEvent = {
  async press(node: ReturnType<typeof screen.getByTestId>) {
    const handler = node.props?.onPress;
    if (typeof handler !== 'function') {
      return;
    }
    await act(async () => {
      await handler();
    });
  },
};

export async function waitFor(
  assertion: () => void,
  options: WaitForOptions = {},
): Promise<void> {
  const { interval = 20, timeout = 1000 } = options;
  const start = Date.now();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      assertion();
      return;
    } catch (error) {
      if (Date.now() - start > timeout) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }
}
