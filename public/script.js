document.addEventListener('DOMContentLoaded', () => {
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatArea = document.getElementById('chatArea');
    const clearChatBtn = document.getElementById('clearChatBtn');

    // Fungsi untuk menambahkan pesan ke area chat
    const addMessage = (text, sender) => {
        const messageContainer = document.createElement('div');
        messageContainer.className = sender === 'user' ? "user-message" : "ai-message";

        // Sanitasi teks untuk mencegah XSS sederhana (walaupun ini bukan solusi lengkap)
        const safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        // Mengganti baris baru (\n) dengan <br> agar respons multi-baris terlihat bagus
        const formattedText = safeText.replace(/\n/g, '<br>');

        messageContainer.innerHTML = `
            <div class="message-bubble">
                ${formattedText}
            </div>
        `;

        chatArea.appendChild(messageContainer);
        // Otomatis scroll ke bawah
        chatArea.scrollTop = chatArea.scrollHeight;
    };

    // Fungsi utama untuk mengirim pesan
    const handleSend = async () => {
        const text = userInput.value.trim();
        if (!text) return;

        // 1. Tambahkan pesan user ke UI
        addMessage(text, 'user');

        // Reset input
        userInput.value = '';
        adjustTextareaHeight();

        // Nonaktifkan tombol dan tambahkan indikator loading
        sendBtn.disabled = true;

        try {
            // 🔥 Kirim pesan ke server.js endpoint /ask
            const response = await fetch('/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });

            // Cek status HTTP
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Server Error (${response.status}): ${errorData.error || errorData.detail}`);
            }

            const result = await response.json();
            
            // Logika server.js mengembalikan { success: true, reply: "..." }
            if (result.success && result.reply) {
                // 2. Tambahkan jawaban dari server (n8n) ke UI
                addMessage(result.reply, 'ai');
            } else {
                console.error("Respons berhasil, tapi tidak ada properti 'reply':", result);
                addMessage("⚠️ Respons tidak terformat dengan benar dari server.", 'ai');
            }

        } catch (err) {
            console.error('❌ Error saat memproses chat:', err);
            addMessage(`❌ Terjadi error koneksi atau server: ${err.message || 'Cek console server/browser Anda.'}`, 'ai');
        }

        // Aktifkan kembali tombol
        sendBtn.disabled = false;
    };

    // Fungsi untuk membersihkan chat
    const clearChat = () => {
        if (confirm('Apakah Anda yakin ingin menghapus semua pesan?')) {
            // Kosongkan area chat
            chatArea.innerHTML = '';

            // Tambahkan pesan selamat datang kembali
            const welcomeMessage = document.createElement('div');
            welcomeMessage.className = 'ai-message';
            welcomeMessage.innerHTML = `
                <div class="message-bubble">
                    <p class="font-semibold text-indigo-600 mb-1">👋 Halo! Selamat Datang!</p>
                    <p>Saya adalah Asisten AI Anda yang terhubung langsung ke backend n8n. Silakan ketik pertanyaan Anda di bawah, dan saya akan memberikan respons real-time.</p>
                </div>
            `;
            chatArea.appendChild(welcomeMessage);
        }
    };

    // Fungsi untuk mengatur tinggi textarea secara otomatis
    const adjustTextareaHeight = () => {
        userInput.style.height = 'auto';
        userInput.style.height = userInput.scrollHeight + 'px';
    };

    // Event Listeners
    sendBtn.addEventListener('click', handleSend);
    clearChatBtn.addEventListener('click', clearChat);

    userInput.addEventListener('keydown', (e) => {
        // Kirim jika Enter ditekan TANPA Shift
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    userInput.addEventListener('input', adjustTextareaHeight);
    adjustTextareaHeight();
});