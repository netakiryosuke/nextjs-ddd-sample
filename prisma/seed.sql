BEGIN;

-- DBのセッション設定に依存せず、日本時間を基準に開催日時を用意する。
SET LOCAL TIME ZONE 'Asia/Tokyo';

INSERT INTO venues (id, name) VALUES
    ('10000000-0000-4000-8000-000000000001', '本館地下1階 食品イベントスペース'),
    ('10000000-0000-4000-8000-000000000002', '本館6階 美術ギャラリー'),
    ('10000000-0000-4000-8000-000000000003', '本館5階 リビングイベントスペース')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- デモを再開できるよう、seed対象の開催情報を投入日の日本時間で更新する。
INSERT INTO events (id, title, venue_id, start_time, end_time, capacity) VALUES
    (
        '20000000-0000-4000-8000-000000000001',
        '産地で味わう日本茶の飲み比べセミナー',
        '10000000-0000-4000-8000-000000000001',
        CURRENT_DATE + INTERVAL '7 days 11 hours',
        CURRENT_DATE + INTERVAL '7 days 12 hours',
        12
    ),
    (
        '20000000-0000-4000-8000-000000000002',
        '現代アート展 出展作家によるアーティストトーク',
        '10000000-0000-4000-8000-000000000002',
        CURRENT_DATE + INTERVAL '8 days 14 hours',
        CURRENT_DATE + INTERVAL '8 days 15 hours',
        8
    ),
    (
        '20000000-0000-4000-8000-000000000003',
        '季節のうつわで楽しむテーブルコーディネート講座',
        '10000000-0000-4000-8000-000000000003',
        CURRENT_DATE + INTERVAL '10 days 13 hours',
        CURRENT_DATE + INTERVAL '10 days 14 hours 30 minutes',
        10
    ),
    (
        '20000000-0000-4000-8000-000000000004',
        '日本画展 学芸員によるギャラリートーク',
        '10000000-0000-4000-8000-000000000002',
        CURRENT_DATE - INTERVAL '1 day' + INTERVAL '14 hours',
        CURRENT_DATE - INTERVAL '1 day' + INTERVAL '15 hours',
        20
    )
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    venue_id = EXCLUDED.venue_id,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    capacity = EXCLUDED.capacity;

INSERT INTO reservations (
    id, event_id, user_id, status, reserved_at, cancelled_at
) VALUES
    (
        '30000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        'demo-customer-1', 'reserved', CURRENT_TIMESTAMP, NULL
    ),
    (
        '30000000-0000-4000-8000-000000000002',
        '20000000-0000-4000-8000-000000000001',
        'demo-customer-2', 'reserved', CURRENT_TIMESTAMP, NULL
    ),
    (
        '30000000-0000-4000-8000-000000000003',
        '20000000-0000-4000-8000-000000000001',
        'demo-customer-3', 'cancelled',
        CURRENT_TIMESTAMP - INTERVAL '2 hours',
        CURRENT_TIMESTAMP - INTERVAL '1 hour'
    ),
    (
        '30000000-0000-4000-8000-000000000004',
        '20000000-0000-4000-8000-000000000002',
        'demo-customer-1', 'reserved', CURRENT_TIMESTAMP, NULL
    ),
    (
        '30000000-0000-4000-8000-000000000005',
        '20000000-0000-4000-8000-000000000002',
        'demo-customer-2', 'reserved', CURRENT_TIMESTAMP, NULL
    ),
    (
        '30000000-0000-4000-8000-000000000006',
        '20000000-0000-4000-8000-000000000003',
        'demo-customer-1', 'reserved',
        CURRENT_TIMESTAMP, NULL
    ),
    (
        '30000000-0000-4000-8000-000000000007',
        '20000000-0000-4000-8000-000000000002',
        'demo-customer-3', 'reserved', CURRENT_TIMESTAMP, NULL
    ),
    (
        '30000000-0000-4000-8000-000000000008',
        '20000000-0000-4000-8000-000000000002',
        'demo-customer-4', 'reserved', CURRENT_TIMESTAMP, NULL
    ),
    (
        '30000000-0000-4000-8000-000000000009',
        '20000000-0000-4000-8000-000000000002',
        'demo-customer-5', 'reserved', CURRENT_TIMESTAMP, NULL
    ),
    (
        '30000000-0000-4000-8000-000000000010',
        '20000000-0000-4000-8000-000000000002',
        'demo-customer-6', 'reserved', CURRENT_TIMESTAMP, NULL
    ),
    (
        '30000000-0000-4000-8000-000000000011',
        '20000000-0000-4000-8000-000000000002',
        'demo-customer-7', 'reserved', CURRENT_TIMESTAMP, NULL
    ),
    (
        '30000000-0000-4000-8000-000000000012',
        '20000000-0000-4000-8000-000000000002',
        'demo-customer-8', 'reserved', CURRENT_TIMESTAMP, NULL
    ),
    (
        '30000000-0000-4000-8000-000000000013',
        '20000000-0000-4000-8000-000000000004',
        'demo-customer-1', 'reserved',
        CURRENT_DATE - INTERVAL '1 day' + INTERVAL '13 hours', NULL
    )
ON CONFLICT DO NOTHING;

COMMIT;
