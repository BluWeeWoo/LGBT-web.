<?php
declare(strict_types=1);

function photoDirectory(string $album): string {
    return dirname(__DIR__, 2) . '/storage/story-photos/' . checkedId($album);
}

function photoFile(string $album, string $name): string {
    return photoDirectory($album) . '/' . $name . '.jpg';
}

function writePhotoFile(string $album, string $name, string $bytes): void {
    $directory = photoDirectory($album);
    if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new RuntimeException('Could not create the photo directory.');
    }
    $target = photoFile($album, $name);
    // Legacy migration may resume after writing a file but before committing its metadata.
    if (is_file($target)) {
        if (file_get_contents($target) !== $bytes) throw new RuntimeException('Existing photo differs.');
        return;
    }
    $temp = $directory . '/.' . bin2hex(random_bytes(12)) . '.tmp';
    try {
        if (@file_put_contents($temp, $bytes, LOCK_EX) !== strlen($bytes) ||
            @file_get_contents($temp) !== $bytes || !@rename($temp, $target)) {
            throw new RuntimeException('Could not save the photo.');
        }
    } finally {
        if (is_file($temp)) @unlink($temp);
    }
}

function removePhotoFiles(?string $album): void {
    if ($album === null) return;
    $directory = photoDirectory($album);
    foreach (['0', '1', '2', 'portrait'] as $name) {
        $file = photoFile($album, $name);
        if (is_file($file) && !@unlink($file) && is_file($file)) {
            throw new RuntimeException('Could not remove a story photo.');
        }
    }
    if (is_dir($directory) && !@rmdir($directory) && is_dir($directory)) {
        throw new RuntimeException('Could not remove the photo directory.');
    }
}
