import { SetMetadata } from '@nestjs/common';

export const FIRST_USER_BOOTSTRAP_KEY = 'firstUserBootstrap';
export const FirstUserBootstrap = () => SetMetadata(FIRST_USER_BOOTSTRAP_KEY, true);
