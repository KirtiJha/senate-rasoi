// Backwards-compatible re-export. The device-stored profile has been replaced
// by the authenticated profile (see context/auth.tsx); useProfile() now reads
// from there so existing screens keep working unchanged.
export { useProfile } from './auth';
