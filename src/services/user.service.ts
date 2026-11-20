import { extensionFor, IMAGE_TYPES } from '@/utils/uploadPolicy';
import * as UserRepository from '../repositories/user.repository';
import * as HobbyRepository from '../repositories/hobby.repository';
import { ProfileInfo } from '@/types/user';
import ApiError, { ERROR_MESSAGES } from '../utils/ApiError';
import { supabase } from '@/lib/supabase';
import logger from '@/lib/logger';

export const completeUserProfile = async (userId: string, profileInfo: ProfileInfo) => {
    const updatedUser = await UserRepository.updateUserProfile(userId, profileInfo);
    return updatedUser;
};

/**
 * Retrieves a user's full profile.
 * @param userId - The ID of the user to retrieve.
 * @returns The user's profile data.
 */
export const getUserProfile = async (userId: string) => {
    return UserRepository.findProfileById(userId);
};

/**
 * Retrieves a user's public profile by username.
 * @param username - The username of the user to retrieve.
 * @returns The user's profile data.
 */
export const getUserProfileByUsername = async (username: string) => {
    return UserRepository.findProfileByUsername(username);
};

/**
 * Updates a single attribute of a user's profile.
 * @param userId - The ID of the user.
 * @param field - The name of the field to update.
 * @param value - The new value.
 */
export const updateUserProfileAttribute = async (userId: string, field: string, value: any) => {
    if (field === 'username') {
        const existingUser = await UserRepository.findByUsername(value);
        if (existingUser && existingUser.id !== userId) {
            throw new ApiError(409, ERROR_MESSAGES.USERNAME_TAKEN);
        }
    }

    if (field === 'selected_hobbies') {
        const hobbiesAreValid = await HobbyRepository.hobbiesExist(value as string[]);
        if (!hobbiesAreValid) {
            throw new ApiError(400, ERROR_MESSAGES.INVALID_HOBBIES);
        }
    }

    return UserRepository.updateProfileAttribute(userId, field, value);

};

/**
 * Generates a pre-signed URL for uploading a user's profile image to Supabase Storage.
 * The file name is chosen here: it used to come from the client and went
 * straight into the storage path (with upsert), so a crafted name could
 * point outside the user's own folder.
 * @param userId - The ID of the user.
 * @param contentType - The image's MIME type (already validated).
 * @returns An object containing the signed upload URL and the public URL of the file.
 * @throws {ApiError} If there is an error generating the signed URL.
 */
export const generateProfileUploadUrl = async (userId: string, contentType: string) => {
    const bucketName = 'avatars';
    const extension = extensionFor(contentType, IMAGE_TYPES) ?? 'jpg';
    const filePath = `${userId}/avatar-${Date.now()}.${extension}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .createSignedUploadUrl(filePath, {
            upsert: true,
        });

    if (uploadError) {
        logger.error('Supabase createSignedUploadUrl error', { error: uploadError.message });
        return null;
    }

    const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

    if (!publicUrlData) {
        return null;
    }

    return {
        signedUploadUrl: uploadData.signedUrl,
        publicUrl: publicUrlData.publicUrl,
    };
};

export const updateUserProfileFromBody = async (userId: string, body: Record<string, unknown>) => {
    const fieldToUpdate = Object.keys(body)[0];
    const value = body[fieldToUpdate];

    if (!fieldToUpdate) {
        throw new ApiError(400, ERROR_MESSAGES.FIELD_NOT_ALLOWED);
    }

    return updateUserProfileAttribute(userId, fieldToUpdate, value);
};
