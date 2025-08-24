import { SetMetadata } from '@nestjs/common';

/**
 * @constant IS_PUBLIC_KEY
 * @purpose Metadata key for public routes
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * @decorator Public
 * @purpose Mark routes as public (no authentication required)
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);