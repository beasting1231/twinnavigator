
export type UserRole = 'pilot' | 'driver' | 'agency';

export interface Profile {
  id: string;
  username: string;
  role: UserRole;
  gender?: string;
  is_onboarded: boolean;
}
