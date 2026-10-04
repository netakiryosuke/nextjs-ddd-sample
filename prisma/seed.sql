BEGIN;

-- DBのセッション設定に依存せず、日本時間を基準に開催日時を用意する。
SET LOCAL TIME ZONE 'Asia/Tokyo';

INSERT INTO venues (id, name) VALUES
    ('10000000-0000-4000-8000-000000000001', '青山アトリエ'),
    ('10000000-0000-4000-8000-000000000002', '神田コミュニティホール')
ON CONFLICT (id) DO NOTHING;

-- 固定IDで重複を防ぎ、再実行時も編集済みの開催情報を上書きしない。
INSERT INTO events (id, title, venue_id, start_time, end_time, capacity) VALUES
    (
        '20000000-0000-4000-8000-000000000001',
        'はじめての陶芸ワークショップ',
        '10000000-0000-4000-8000-000000000001',
        CURRENT_DATE + INTERVAL '1 day 10 hours',
        CURRENT_DATE + INTERVAL '1 day 12 hours',
        5
    ),
    (
        '20000000-0000-4000-8000-000000000002',
        '少人数で楽しむコーヒー講座',
        '10000000-0000-4000-8000-000000000002',
        CURRENT_DATE + INTERVAL '2 days 14 hours',
        CURRENT_DATE + INTERVAL '2 days 16 hours',
        2
    ),
    (
        '20000000-0000-4000-8000-000000000003',
        '街歩き写真ワークショップ',
        '10000000-0000-4000-8000-000000000002',
        CURRENT_DATE - INTERVAL '1 day' + INTERVAL '10 hours',
        CURRENT_DATE - INTERVAL '1 day' + INTERVAL '12 hours',
        4
    )
ON CONFLICT (id) DO NOTHING;

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
        CURRENT_DATE - INTERVAL '1 day' + INTERVAL '9 hours', NULL
    )
ON CONFLICT DO NOTHING;

COMMIT;
