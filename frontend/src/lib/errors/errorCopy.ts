/**
 * Every error the app can show, in plain words: what went wrong and what to do next.
 * This is the only place error copy lives. Keep titles short; messages always end with a next step.
 */
import { MAX_UPLOAD_MB, MODEL_INPUT } from '@/lib/config'

export const APP_ERROR_CODES = [
  'OFFLINE',
  'NETWORK',
  'TIMEOUT',
  'ABORTED',
  'NOT_FOUND',
  'INVALID_RESPONSE',
  'FILE_TOO_LARGE',
  'UNSUPPORTED_FILE',
  'INVALID_IMAGE',
  'BAD_REQUEST',
  'ACCESS_DENIED',
  'RATE_LIMITED',
  'MODEL_FAILED',
  'SERVER',
  'SERVICE_UNAVAILABLE',
  'NOT_IMPLEMENTED',
  'EXPORT_FAILED',
  'CLIPBOARD_BLOCKED',
  'UNEXPECTED',
] as const

export type AppErrorCode = (typeof APP_ERROR_CODES)[number]

export interface ErrorCopy {
  title: string
  message: string
  /** True when trying the same thing again can work. False means the user must change something. */
  recoverable: boolean
}

export const ERROR_COPY: Readonly<Record<AppErrorCode, ErrorCopy>> = {
  OFFLINE: {
    title: "You're offline",
    message:
      'This device lost its connection. Reconnect, then try again. What is already on screen stays available.',
    recoverable: true,
  },
  NETWORK: {
    title: "Can't reach the processing service",
    message: 'The service did not answer. Check your connection, then try again.',
    recoverable: true,
  },
  TIMEOUT: {
    title: 'The service took too long to respond',
    message: 'It may be busy. Wait a moment, then try again.',
    recoverable: true,
  },
  ABORTED: {
    title: 'Request cancelled',
    message: 'The request stopped before it finished. Start it again when you are ready.',
    recoverable: true,
  },
  NOT_FOUND: {
    title: 'Not found',
    message:
      'Nothing exists at this address. It may have been removed, or the link is wrong. Go back to the observations and pick another.',
    recoverable: false,
  },
  INVALID_RESPONSE: {
    title: 'The service sent data this app cannot read',
    message:
      'Nothing was shown, to avoid displaying wrong figures. Try again; if it keeps happening, the service and the app may be out of step.',
    recoverable: true,
  },
  FILE_TOO_LARGE: {
    title: 'This file is too large',
    message: `Images can be up to ${MAX_UPLOAD_MB} MB. Crop or compress the image, then upload it again.`,
    recoverable: false,
  },
  UNSUPPORTED_FILE: {
    title: 'This file type is not supported',
    message: `Upload an ${MODEL_INPUT.bands}-band Sentinel-2 GeoTIFF (.tif) instead. PNG and JPEG images do not carry the bands the model needs.`,
    recoverable: false,
  },
  INVALID_IMAGE: {
    title: "This image can't be analysed",
    message: `The file could not be read as an ${MODEL_INPUT.bands}-band Sentinel-2 GeoTIFF with location data. Upload one under ${MAX_UPLOAD_MB} MB, or add the image bounds manually.`,
    recoverable: false,
  },
  BAD_REQUEST: {
    title: 'The service did not accept the request',
    message: 'Some of the details sent were not valid. Check the form, then try again.',
    recoverable: false,
  },
  ACCESS_DENIED: {
    title: 'The service refused access',
    message:
      'This app is not allowed to use the processing service. Check the service address and credentials in the app configuration, then reload.',
    recoverable: false,
  },
  RATE_LIMITED: {
    title: 'The service is handling too many requests',
    message: 'Wait a minute, then try again.',
    recoverable: true,
  },
  MODEL_FAILED: {
    title: 'The detection step failed',
    message:
      'The detection model stopped before finishing. Try again. If it fails again, try a smaller image.',
    recoverable: true,
  },
  SERVER: {
    title: 'The processing service had a problem',
    message: 'Try again in a moment. If it keeps happening, the service may be down.',
    recoverable: true,
  },
  SERVICE_UNAVAILABLE: {
    title: 'The processing service is unavailable',
    message: 'It may be restarting or overloaded. Try again in a minute.',
    recoverable: true,
  },
  NOT_IMPLEMENTED: {
    title: 'Not available from the live service yet',
    message:
      'The connected service does not support this yet. Switch to sample data (VITE_USE_MOCK=true) or update the service.',
    recoverable: false,
  },
  EXPORT_FAILED: {
    title: 'The export could not be created',
    message:
      'Nothing was downloaded. Try again; if it keeps failing, reload the page and export again.',
    recoverable: true,
  },
  CLIPBOARD_BLOCKED: {
    title: 'The link could not be copied',
    message: 'The browser blocked clipboard access. Copy the address from the address bar instead.',
    recoverable: false,
  },
  UNEXPECTED: {
    title: 'This part of the app stopped working',
    message: 'Reload the page to try again. Your data is not affected.',
    recoverable: true,
  },
}

/** A single panel failed to render; the page around it still works. */
export const PANEL_ERROR_COPY = {
  title: (panel?: string) =>
    panel ? `${panel} could not be shown` : 'This panel could not be shown',
  message: 'The rest of the page still works. Try again, or reload the page if it keeps happening.',
} as const
