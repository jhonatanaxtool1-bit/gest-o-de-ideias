"""
Processamento de áudio: download do Telegram, conversão ogg->wav, transcrição.
Transcrição via Google Web Speech API (gratuita, não oficial) usando SpeechRecognition.
"""
import logging
import subprocess
import tempfile
from pathlib import Path

import speech_recognition as sr

logger = logging.getLogger(__name__)


class FFmpegNotFoundError(FileNotFoundError):
    """Levantada quando o ffmpeg não está instalado ou não está no PATH."""


# Google Web Speech tem limite prático de ~1 minuto; áudios maiores são cortados
DURACAO_MAX_SEGUNDOS = 60


async def baixar_arquivo_voice(file_id: str, bot) -> str:
    """
    Baixa o arquivo de voz do Telegram em diretório temporário.
    bot: instância com get_file (ex.: context.bot ou application.bot).
    Retorna o path do arquivo .ogg.
    """
    import os

    logger.info("Baixando áudio do Telegram: file_id=%s", file_id)
    arquivo = await bot.get_file(file_id)
    suffix = Path(arquivo.file_path or "").suffix or ".ogg"
    fd, path = tempfile.mkstemp(suffix=suffix, prefix="voice_")
    os.close(fd)
    try:
        os.unlink(path)
    except OSError:
        pass
    await arquivo.download_to_drive(custom_path=path)
    logger.info("Download concluído: %s", path)
    return path


def ogg_para_wav(caminho_ogg: str) -> str:
    """
    Converte arquivo .ogg para .wav usando ffmpeg.
    Retorna o path do .wav. O .ogg pode ser removido pelo caller se desejado.
    """
    path_ogg = Path(caminho_ogg)
    path_wav = path_ogg.with_suffix(".wav")
    logger.info("Convertendo ogg -> wav: %s -> %s", path_ogg, path_wav)
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(path_ogg),
                "-acodec",
                "pcm_s16le",
                "-ar",
                "16000",
                "-ac",
                "1",
                str(path_wav),
            ],
            check=True,
            capture_output=True,
        )
        logger.info("Conversão concluída: %s", path_wav)
        return str(path_wav)
    except FileNotFoundError as e:
        logger.error("ffmpeg não encontrado. Instale e coloque no PATH.")
        raise FFmpegNotFoundError("ffmpeg não encontrado. Instale e adicione ao PATH.") from e
    except subprocess.CalledProcessError as e:
        logger.error("ffmpeg falhou: stderr=%s", e.stderr and e.stderr.decode()[:500])
        raise


def transcrever(caminho_wav: str, idioma: str = "pt-BR") -> str:
    """
    Transcreve áudio (WAV) para texto usando Google Web Speech API (gratuita).
    Áudios com mais de 1 minuto são truncados devido a limite da API.
    """
    path = Path(caminho_wav)
    if not path.exists():
        logger.error("Arquivo não encontrado: %s", caminho_wav)
        raise FileNotFoundError(f"Arquivo de áudio não encontrado: {caminho_wav}")

    recognizer = sr.Recognizer()
    logger.info("Transcrevendo áudio: %s", path)

    with sr.AudioFile(str(path)) as source:
        # Limita duração para evitar exceder limite da API
        audio = recognizer.record(source, duration=DURACAO_MAX_SEGUNDOS)

    try:
        texto = recognizer.recognize_google(audio, language=idioma)
        logger.info("Transcrição concluída: %d caracteres", len(texto or ""))
        return texto.strip() if texto else ""
    except sr.UnknownValueError:
        logger.warning("Google Web Speech não reconheceu o áudio")
        return ""
    except sr.RequestError as e:
        logger.error("Erro na requisição ao Google Web Speech: %s", e)
        raise
