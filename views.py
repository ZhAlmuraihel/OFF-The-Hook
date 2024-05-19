from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.response import Response
from .utils import predict, remove_hidden_html_styles, extract_urls, scan_url_with_virustotal


class HelloView(APIView):
    def get(self, request):
        return Response({"message": "Hello"})

class StatusView(APIView):
    def get(self, request):
        return Response({"status": True, "message": "Working"})

class EmailProcessView(APIView):
    def post(self, request):
        email_content = request.data.get('email_content')
        prediction = predict(email_content)
        return Response({"prediction": prediction})

class ContentModificationView(APIView):
    def post(self, request):
        html_content = request.data.get('html_content')
        cleaned_html = remove_hidden_html_styles(html_content)
        return Response({"cleaned_html": cleaned_html})

class URLAnalysisView(APIView):
    def post(self, request):
        html_content = request.data.get('html_content')
        api_key = request.data.get('api_key')
        urls = extract_urls(html_content)
        results = {url: scan_url_with_virustotal(url, api_key) for url in urls}
        return Response({"url_results": results})

