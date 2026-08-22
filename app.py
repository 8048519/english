import webview
import os

if __name__ == "__main__":
    html_path = os.path.join(os.path.dirname(__file__), 'index.html')
    webview.create_window(
        title='英语背单词',
        url=html_path,  
        width=800,
        height=600
    )
    webview.start(http_server=True)