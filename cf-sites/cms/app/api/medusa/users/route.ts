import { getEnv, jsonResponse, errorResponse, requireAuth } from '@/lib/api-utils';
import { NextRequest } from 'next/server';
import { createMedusaClient } from '@/lib/medusa-admin';

export const runtime = 'edge';

// Create User
export async function POST(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const env = await getEnv();
  
  let client;
  try {
    client = await createMedusaClient(env);
  } catch (e) {
    return errorResponse('Medusa configuration missing', 500);
  }
  
  const body = await req.json();
  const { email, password, first_name, last_name } = body;

  if (!email || !password) {
    return errorResponse('Email and password are required', 400);
  }

  try {
    const result = await client.createUser({
      email,
      password,
      first_name,
      last_name,
      role: 'admin' 
    });
    return jsonResponse(result);
  } catch (err: any) {
    const msg = err?.message || '';
    const status = err?.status ?? err?.response?.status;
    
    if (status === 401 || /unauthorized/i.test(msg)) {
      return errorResponse('Medusa backend returned Unauthorized. Check Global Settings → Medusa (API token).', 500);
    }
    
    if (status === 409 || /exists/i.test(msg)) {
      return errorResponse('User with this email already exists.', 409);
    }

    const fallback = status ? `Medusa error (HTTP ${status})` : 'Failed to create user';
    const message = msg && !/unknown error/i.test(msg) ? msg : fallback;
    
    if (process.env.NODE_ENV === 'development') console.error('Medusa createUser error', { message: err?.message, status, err });
    return errorResponse(message, 500);
  }
}

// Reset Password
export async function PUT(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const env = await getEnv();
  
  let client;
  try {
    client = await createMedusaClient(env);
  } catch (e) {
    return errorResponse('Medusa configuration missing', 500);
  }
  
  const body = await req.json();
  const { password } = body;

  if (!password) {
    return errorResponse('New password is required', 400);
  }

  try {
    const result = await client.resetPassword(password);
    return jsonResponse(result);
  } catch (err: any) {
    const msg = err?.message || '';
    const status = err?.status ?? err?.response?.status;
    
    if (status === 401 || /unauthorized/i.test(msg)) {
      return errorResponse('Medusa backend returned Unauthorized. Check Global Settings → Medusa (API token).', 500);
    }

    const fallback = status ? `Medusa error (HTTP ${status})` : 'Failed to reset password';
    const message = msg && !/unknown error/i.test(msg) ? msg : fallback;
    
    if (process.env.NODE_ENV === 'development') console.error('Medusa resetPassword error', { message: err?.message, status, err });
    return errorResponse(message, 500);
  }
}
