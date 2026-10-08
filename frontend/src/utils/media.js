// Check the browser capability rather than guessing from the device name.
export function canShareScreen() {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getDisplayMedia === "function"
  );
}

export const screenShareUnavailable =
  "This browser cannot share its screen. Join from a supported desktop browser to present. You can still watch shared screens here.";

export function screenShareError(error) {
  if (error?.name === "NotAllowedError")
    return "Screen sharing was cancelled or permission was denied. Choose Share Screen again and select a screen, window, or tab.";
  return "Could not start screen sharing. Check browser permissions and try again.";
}
