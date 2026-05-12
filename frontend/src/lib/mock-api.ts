/**
 * Mock API Server
 * 開発用のモックAPIサーバー（バックエンドが利用できない場合に使用）
 */

// モック用の遅延関数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// モックデータ
const mockContacts: any[] = [];

export const mockApi = {
  // 問い合わせ送信のモック
  submitContact: async (contactData: {
    name: string;
    email: string;
    phone?: string;
    lesson_type: string;
    preferred_contact: string;
    message: string;
  }) => {
    // リアルなAPI遅延をシミュレート
    await delay(1000 + Math.random() * 2000);

    // バリデーションエラーのシミュレート（10%の確率）
    if (Math.random() < 0.1) {
      throw new Error('バリデーションエラー: メールアドレスの形式が正しくありません。');
    }

    // サーバーエラーのシミュレート（5%の確率）
    if (Math.random() < 0.05) {
      throw new Error('サーバーエラーが発生しました。しばらく時間をおいて再度お試しください。');
    }

    // 成功時のレスポンス
    const newContact = {
      id: `contact_${Date.now()}`,
      ...contactData,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockContacts.push(newContact);

    console.log('Mock API: Contact submitted successfully', newContact);

    return {
      success: true,
      data: newContact,
      message: 'お問い合わせを受け付けました。確認メールをお送りしました。'
    };
  },

  // 問い合わせ一覧取得のモック（管理者用）
  getContacts: async (params?: { page?: number; limit?: number; status?: string }) => {
    await delay(500);

    const { page = 1, limit = 10, status } = params || {};
    let filteredContacts = [...mockContacts];

    if (status) {
      filteredContacts = filteredContacts.filter(contact => contact.status === status);
    }

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedContacts = filteredContacts.slice(startIndex, endIndex);

    return {
      success: true,
      data: {
        contacts: paginatedContacts,
        pagination: {
          page,
          limit,
          total: filteredContacts.length,
          totalPages: Math.ceil(filteredContacts.length / limit)
        }
      }
    };
  },

  // 問い合わせ詳細取得のモック（管理者用）
  getContactById: async (id: string) => {
    await delay(300);

    const contact = mockContacts.find(c => c.id === id);
    if (!contact) {
      throw new Error('お問い合わせが見つかりません。');
    }

    return {
      success: true,
      data: contact
    };
  },

  // 問い合わせステータス更新のモック（管理者用）
  updateContactStatus: async (id: string, status: string) => {
    await delay(500);

    const contactIndex = mockContacts.findIndex(c => c.id === id);
    if (contactIndex === -1) {
      throw new Error('お問い合わせが見つかりません。');
    }

    mockContacts[contactIndex] = {
      ...mockContacts[contactIndex],
      status,
      updatedAt: new Date().toISOString()
    };

    return {
      success: true,
      data: mockContacts[contactIndex],
      message: 'ステータスを更新しました。'
    };
  }
};

// 開発環境でのモックAPI使用フラグ
export const USE_MOCK_API = process.env.NODE_ENV === 'development' && 
  process.env.NEXT_PUBLIC_USE_MOCK_API === 'true';