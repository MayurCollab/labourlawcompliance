import expressAsyncHandler from 'express-async-handler';

/**
 * Async controller wrapper — forwards rejected promises to next().
 * Convention: ALL async controllers are wrapped with this (single import
 * point so the underlying implementation can change without touching
 * every module).
 *
 * Usage:
 *   export const getThing = asyncHandler(async (req, res) => { ... });
 */
const asyncHandler = expressAsyncHandler;

export default asyncHandler;
