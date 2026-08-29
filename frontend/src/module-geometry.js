export function moduleGeometry(module, viewport) {
    const maxWidth = Math.max(1, viewport.width - 16);
    const maxHeight = Math.max(1, viewport.height - 16);
    const width = Math.min(module.width, maxWidth);
    const height = Math.min(module.height, maxHeight);
    const x = Math.min(Math.max(0, module.x), Math.max(0, viewport.width - width));
    const y = Math.min(Math.max(0, module.y), Math.max(0, viewport.height - height));
    return { x, y, width, height };
}

export function constrainModuleGeometry(module, viewport) {
    return { ...module, ...moduleGeometry(module, viewport) };
}
