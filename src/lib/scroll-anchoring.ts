export type BottomPinScheduler = {
  schedule: () => void;
  dispose: () => void;
};

export function createBottomPinScheduler(params: {
  requestFrame: (callback: FrameRequestCallback) => number;
  cancelFrame: (handle: number) => void;
  shouldPin: () => boolean;
  pinToBottom: () => void;
}): BottomPinScheduler {
  let frameHandle: number | null = null;

  const schedule = () => {
    if (frameHandle !== null) {
      params.cancelFrame(frameHandle);
    }
    frameHandle = params.requestFrame(() => {
      frameHandle = null;
      if (!params.shouldPin()) {
        return;
      }
      params.pinToBottom();
    });
  };

  const dispose = () => {
    if (frameHandle === null) {
      return;
    }
    params.cancelFrame(frameHandle);
    frameHandle = null;
  };

  return { schedule, dispose };
}
