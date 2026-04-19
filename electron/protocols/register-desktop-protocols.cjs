function registerDesktopProtocolSchemes(params) {
  const { protocol, localImageScheme, fsScheme } = params || {};
  if (
    !protocol ||
    typeof protocol.registerSchemesAsPrivileged !== "function" ||
    typeof localImageScheme !== "string" ||
    !localImageScheme ||
    typeof fsScheme !== "string" ||
    !fsScheme
  ) {
    throw new Error("registerDesktopProtocolSchemes requires protocol and scheme names");
  }

  protocol.registerSchemesAsPrivileged([
    {
      scheme: localImageScheme,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
    {
      scheme: fsScheme,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

function registerDesktopProtocolHandlers(params) {
  const {
    protocol,
    localImageScheme,
    fsScheme,
    handleLocalImageRequest,
    handleFsRequest,
  } = params || {};

  if (
    !protocol ||
    typeof protocol.handle !== "function" ||
    typeof localImageScheme !== "string" ||
    !localImageScheme ||
    typeof fsScheme !== "string" ||
    !fsScheme ||
    typeof handleLocalImageRequest !== "function" ||
    typeof handleFsRequest !== "function"
  ) {
    throw new Error("registerDesktopProtocolHandlers requires protocol, scheme names, and handlers");
  }

  protocol.handle(localImageScheme, handleLocalImageRequest);
  protocol.handle(fsScheme, handleFsRequest);
}

module.exports = {
  registerDesktopProtocolSchemes,
  registerDesktopProtocolHandlers,
};
