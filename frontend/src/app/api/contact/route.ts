import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // フィールド名をバックエンドAPIの形式に変換
    const backendPayload = {
      name: body.name,
      email: body.email,
      message: body.message,
      phone: body.phone,
      lesson_type: body.lessonType,
      preferred_contact: body.preferredContact,
    };
    
    // バックエンドAPIに転送
    const backendUrl = process.env.BACKEND_URL || 'http://backend:8000';
    const response = await fetch(`${backendUrl}/api/v1/contacts/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(backendPayload),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Backend API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to submit contact form' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Contact API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}