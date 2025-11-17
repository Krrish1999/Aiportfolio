/**
 * Cloudflare Pages Function for file upload with R2 storage
 * This runs as a Cloudflare Worker and has access to bindings
 */

interface Env {
  RESUME_BUCKET: R2Bucket;
  RESUME_CACHE: KVNamespace;
  DB: D1Database;
  JOB_QUEUE: DurableObjectNamespace;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string | null;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate file
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      return new Response(JSON.stringify({ error: 'File too large' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Generate IDs
    const sessionId = crypto.randomUUID();
    const actualUserId = userId || crypto.randomUUID();
    const fileKey = `uploads/${actualUserId}/${sessionId}/${file.name}`;

    // Upload to R2
    const fileBuffer = await file.arrayBuffer();
    await env.RESUME_BUCKET.put(fileKey, fileBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
      customMetadata: {
        userId: actualUserId,
        sessionId,
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    });

    // Store session info in KV
    await env.RESUME_CACHE.put(
      `session:${sessionId}`,
      JSON.stringify({
        sessionId,
        userId: actualUserId,
        fileName: file.name,
        fileKey,
        status: 'uploaded',
        createdAt: new Date().toISOString(),
      }),
      { expirationTtl: 86400 } // 24 hours
    );

    // Store in D1 database
    try {
      await env.DB.prepare(
        `INSERT INTO resume_sessions (id, user_id, file_key, original_filename, file_format, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          sessionId,
          actualUserId,
          fileKey,
          file.name,
          file.type,
          'uploaded',
          new Date().toISOString()
        )
        .run();
    } catch (dbError) {
      console.warn('Database insert failed:', dbError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          sessionId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          status: 'uploaded',
          message: 'File uploaded successfully',
        },
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Upload error:', error);
    return new Response(
      JSON.stringify({
        error: 'Upload failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
