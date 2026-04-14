/**
 * Filesystem helper utilities for claim folder operations.
 *
 * Maps Windows-style claim folder paths (Z:\...) to local Linux paths
 * under /home/z/my-project/claims-data/ and handles folder creation,
 * metadata persistence, and document saving.
 */

import { mkdir, writeFile } from 'fs/promises'
import path from 'path'

/** Base directory for all claim data on the local filesystem */
const CLAIMS_DATA_BASE = '/home/z/my-project/claims-data'

/**
 * Convert a Windows-style folder path to a local Linux path.
 *
 * - Replaces `Z:\` prefix with the claims-data base path
 * - Replaces all backslashes with forward slashes
 *
 * @param windowsPath - A Windows path like "Z:\2026\April\SANTAM\STF00123 - J van der Merwe"
 * @returns The local path like "/home/z/my-project/claims-data/2026/April/SANTAM/STF00123 - J van der Merwe"
 */
export function getLocalPath(windowsPath: string): string {
  // Replace Z:\ prefix (case-insensitive) with base path
  let localPath = windowsPath.replace(/^Z:\\/i, `${CLAIMS_DATA_BASE}/`)
  // Replace remaining backslashes with forward slashes
  localPath = localPath.replace(/\\/g, '/')
  return localPath
}

/**
 * Create a claim folder on the filesystem with an Attachments subfolder.
 *
 * @param folderPath - The Windows-style folder path (e.g. "Z:\2026\April\SANTAM\STF00123 - J van der Merwe")
 * @returns Object with success flag, actual local path, and optional error message
 */
export async function createClaimFolder(
  folderPath: string
): Promise<{ success: boolean; actualPath: string; error?: string }> {
  const localPath = getLocalPath(folderPath)

  try {
    // Create the main claim folder (recursive so parent dirs are created too)
    await mkdir(localPath, { recursive: true })

    // Create the Attachments subfolder
    const attachmentsPath = path.join(localPath, 'Attachments')
    await mkdir(attachmentsPath, { recursive: true })

    return { success: true, actualPath: localPath }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[fs-helpers] Failed to create claim folder at "${localPath}":`, errorMsg)
    return { success: false, actualPath: localPath, error: errorMsg }
  }
}

/**
 * Save email / claim metadata as a JSON file inside the claim folder.
 *
 * @param folderPath - The Windows-style folder path
 * @param claimData - Arbitrary claim data object to persist
 */
export async function saveEmailMetadata(
  folderPath: string,
  claimData: Record<string, unknown>
): Promise<void> {
  const localPath = getLocalPath(folderPath)
  const metadataPath = path.join(localPath, 'email_metadata.json')

  try {
    const content = JSON.stringify(
      {
        ...claimData,
        _meta: {
          savedAt: new Date().toISOString(),
          localPath,
          originalFolderPath: folderPath,
        },
      },
      null,
      2
    )

    await writeFile(metadataPath, content, 'utf-8')
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[fs-helpers] Failed to save email metadata at "${metadataPath}":`, errorMsg)
    // Don't throw — metadata saving failure should not break the pipeline
  }
}
