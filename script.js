document.addEventListener('DOMContentLoaded', () => {
    // ⭐ 중요: 이 부분을 새로 배포할 Google Apps Script URL로 변경해 주세요!
    // 이 URL은 데이터를 읽고(GET) 쓰고(POST) 처리하는 Apps Script의 배포 URL이어야 합니다.
    const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwnpwe5nvcKNOHONGesrbdxuWKFrPpbzPpnFLM9YvpFMZ8Clo-ahgAvqnrJwS8S4YCP/exec'; 

    const scoreSelect = document.getElementById('score');
    const recordForm = document.getElementById('record-form');
    const recordsContainer = document.getElementById('records-container');
    const exportButton = document.getElementById('export-excel');
    let recordsCache = []; // 데이터 캐싱

    // 10점부터 100점까지의 옵션 추가
    for (let i = 10; i <= 100; i += 10) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `${i}점`;
        scoreSelect.appendChild(option);
    }
    
    // DOM에 기록 목록 행 추가
    const addRecordToDOM = (record) => {
        const row = document.createElement('div');
        row.classList.add('record-row');

        const moodEmojis = { 
            '편안': '😌', '기쁨': '☺️', '보통': '🫤', '화남': '😤', '슬픔': '😢' 
        };
        
        // Apps Script의 헤더와 일치하는 키 사용 (대문자 주의: Nickname, Score, Mood 등)
        row.innerHTML = `
            <div class="record-nickname" data-label="닉네임">${record.Nickname || ''}</div>
            <div class="record-score" data-label="점수">${record.Score || ''}</div>
            <div class="record-mood" data-label="기분">${moodEmojis[record.Mood] || record.Mood || ''}</div>
            <div class="record-word" data-label="단어" title="${record.Word || ''}">${record.Word || ''}</div>
            <div class="record-summary" data-label="요약" title="${record.Summary || ''}">${record.Summary || ''}</div>
            <div class="record-praise" data-label="칭찬/격려" title="${record.Praise || ''}">${record.Praise || ''}</div>
            <div class="record-helpful" data-label="도움된점" title="${record.Helpful || ''}">${record.Helpful || ''}</div>
        `;
        recordsContainer.prepend(row); // 최신 항목을 가장 위에 추가
    };

    // 데이터 로드 및 화면 업데이트 (Apps Script의 doGet 역할)
    const loadRecords = async () => {
        recordsContainer.innerHTML = '<div style="text-align: center; padding: 20px;">데이터를 불러오는 중...</div>';
        try {
            const response = await fetch(WEB_APP_URL, { method: 'GET' });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error("Apps Script Error Response:", errorText);
                throw new Error(`데이터 로드 실패: ${response.statusText}`);
            }
            
            recordsCache = await response.json();

            if (!Array.isArray(recordsCache)) {
                console.error("Error data received:", recordsCache);
                throw new Error('Google Apps Script에서 유효하지 않은 데이터가 수신되었습니다. 시트/헤더 설정을 확인하세요.');
            }
            
            // Timestamp 기준으로 최신순 정렬
            recordsCache.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
            
            recordsContainer.innerHTML = ''; 
            if (recordsCache.length === 0) {
                recordsContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #777;">아직 기록된 내용이 없습니다.</div>';
            } else {
                recordsCache.forEach(addRecordToDOM);
            }

        } catch (error) {
            console.error('Error loading records:', error);
            const errorMessage = error.message.includes('Sheet not found') 
                ? '⚠️ 시트 이름을 확인하거나 스프레드시트 접근 권한을 확인하세요.' 
                : `데이터 로드 실패: ${error.message}`;

            recordsContainer.innerHTML = `<div style="color: red; padding: 20px; text-align: center;">${errorMessage}</div>`;
        }
    };

    // 폼 제출 이벤트 처리 (Apps Script의 doPost 역할)
    recordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = '저장 중...';

        const formData = new FormData(recordForm);
        // POST 데이터의 키는 Apps Script의 doPost 함수 내부에서 사용할 변수명과 일치해야 합니다.
        const data = {
            score: formData.get('score'),
            mood: formData.get('mood'),
            word: formData.get('word'),
            summary: formData.get('summary'),
            praise: formData.get('praise'),
            helpful: formData.get('helpful'),
            nickname: formData.get('nickname')
        };

        try {
            const response = await fetch(WEB_APP_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json' // JSON 형식으로 데이터 전송
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                throw new Error('Apps Script에서 오류 응답을 받았습니다. (HTTP 상태 코드 오류)');
            }

            // Apps Script에서 성공 메시지를 JSON으로 반환한다고 가정
            const result = await response.json();
            if (result.status === 'error') {
                 throw new Error(result.message);
            }
            
            console.log('✅ 성공적으로 기록되었습니다. 데이터를 새로고침합니다.', result);
            
            recordForm.reset();
            document.getElementById('mood1').checked = true; // 기분 초기화 (편안)

            // 데이터 목록 새로고침
            loadRecords(); 

        } catch (error) {
            console.error('Error submitting record:', error);
            const errorMessage = `❌ 기록 저장에 실패했습니다. Apps Script의 로그를 확인하세요. (${error.message})`;
            alert(errorMessage); 
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = '기록하기';
        }
    });

    // 엑셀 내보내기 이벤트 처리 (SheetJS 사용)
    exportButton.addEventListener('click', () => {
        if (recordsCache.length === 0) {
            alert('내보낼 데이터가 없습니다.');
            return;
        }
        
        // 내보낼 필드 순서와 한글 헤더 정의
        const exportData = recordsCache.map(record => {
            return {
                '기록시간': record.Timestamp, // Apps Script에서 가져온 데이터 키를 사용
                '닉네임': record.Nickname,
                '점수': record.Score,
                '기분': record.Mood,
                '단어': record.Word,
                '요약': record.Summary,
                '칭찬/격려': record.Praise,
                '도움된점': record.Helpful
            };
        }).filter(r => r['점수'] !== undefined); // 데이터가 있는 유효한 행만 내보내기

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "칭찬기록");
        XLSX.writeFile(workbook, "my_praise_records.xlsx");
    });

    // 초기 데이터 로드
    loadRecords();
});