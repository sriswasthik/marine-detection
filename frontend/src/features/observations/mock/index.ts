/**
 * Mock backend
 * ============
 *
 * Active when VITE_USE_MOCK=true (the default). Everything here is synthetic and the UI must
 * label it "Sample data". Model metrics are placeholders and must be labelled "Sample values".
 *
 * Sample observations (./samples.ts), deterministic from fixed seeds:
 *   1. Ennore coast, Bay of Bengal    satellite  completed  about 60 detections, 3 hotspots (hero)
 *   2. Mahim Bay, Mumbai              drone      completed  about 25 detections, Moderate
 *   3. Vembanad Lake, Kochi           satellite  completed  Low density
 *   4. Gulf of Mannar                 satellite  completed  zero detections (valid no-debris result)
 *   5. Visakhapatnam coast            satellite  completed  many low-confidence detections,
 *                                                           warnings LOW_CONFIDENCE and HIGH_CLOUD
 *   6. Sundarbans delta               satellite  partial    crs null, approximate bounds,
 *                                                           warning PARTIAL_GEOREF
 *
 * Scenarios
 * ---------
 * Choose with `?mock=<scenario>` in the URL, or from code with `setMockScenario()` or the
 * `useMockScenario()` hook. A code setting wins over the URL; `setMockScenario(null)` clears it.
 * A job keeps the scenario that was active when it was created.
 *
 *   success    Default. Upload, preprocess, detect, map, then a completed observation. The result
 *              copies the sample named in the file name (for example "mahim.tif"), the drone
 *              sample for drone uploads, or the Ennore hero scene.
 *   nodebris   Completes with the zero-detection Gulf of Mannar result.
 *   lowconf    Completes with the low-confidence Visakhapatnam result.
 *   partial    Completes with the partially georeferenced Sundarbans result.
 *   invalid    Fails at upload with recoverable error INVALID_IMAGE.
 *   modelfail  Fails during detection with recoverable error MODEL_ERROR.
 *   network    Every request rejects with ApiError NETWORK_ERROR (status null).
 *
 * Timing
 * ------
 * List and get calls take 250 to 600 ms. The pipeline takes about 8 s, or about 2 s with
 * VITE_DEMO_FAST=true. createObservation resolves when the upload share (20%) ends.
 */
export {
  DEFAULT_MOCK_SCENARIO,
  getMockScenario,
  isMockScenario,
  MOCK_SCENARIOS,
  setMockScenario,
  subscribeMockScenario,
  type MockScenario,
} from './scenario'
export { useMockScenario } from './useMockScenario'
export {
  getSampleObservation,
  getSampleObservations,
  HERO_SAMPLE_ID,
  pickSampleIdForUpload,
  SAMPLE_IDS,
} from './samples'
export { computeJobState, pipelineDurationMs, PIPELINE_TIMELINE } from './pipeline'
export { createRandom, hashString, type Random } from './random'
export { generateObservation, type SceneSpec } from './generator'
