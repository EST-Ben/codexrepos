import { act, create } from 'react-test-renderer';
import type { ReactElement } from 'react';

type WaitForOptions = {
  interval?: number;
  timeout?: number;
};

let currentInstance: ReturnType<typeof create> | null = null;

function getNodeText(children: unknown): string {
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(getNodeText).join('');
  }
  if (children && typeof children === 'object' && 'props' in (children as any)) {
    return getNodeText((children as any).props?.children);
  }
  return '';
}

export function render(element: ReactElement) {
  act(() => {
    currentInstance = create(element);
  });

  const getByText = (text: string | RegExp) => {
    const matcher =
      typeof text === 'string' ? (value: string) => value === text : (value: string) => text.test(value);
    return requireRoot().find((node) => {
      const value = getNodeText(node.props?.children);
      return value !== '' && matcher(value);
    });
  };

  return {
    getByText,
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
  getByText(text: string | RegExp) {
    const matcher =
      typeof text === 'string' ? (value: string) => value === text : (value: string) => text.test(value);
    return requireRoot().find((node) => {
      const value = getNodeText(node.props?.children);
      return value !== '' && matcher(value);
    });
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
