use tiny_http::Header;

pub fn request_origin(request: &tiny_http::Request) -> Option<String> {
    request
        .headers()
        .iter()
        .find(|header| header.field.equiv("Origin"))
        .map(|header| header.value.as_str().to_string())
}

pub fn is_allowed_browser_origin(origin: &str) -> bool {
    origin.starts_with("chrome-extension://")
        || origin.starts_with("moz-extension://")
        || origin == "http://localhost"
        || origin.starts_with("http://localhost:")
        || origin == "http://127.0.0.1"
        || origin.starts_with("http://127.0.0.1:")
        || origin == "http://[::1]"
        || origin.starts_with("http://[::1]:")
        || origin == "tauri://localhost"
        || origin == "http://tauri.localhost"
        || origin == "https://tauri.localhost"
}

pub fn local_cors_headers(origin: Option<&str>, allow_headers: &str) -> Vec<Header> {
    let mut headers = vec![
        Header::from_bytes("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS").unwrap(),
        Header::from_bytes("Access-Control-Allow-Headers", allow_headers).unwrap(),
        Header::from_bytes("Content-Type", "application/json").unwrap(),
    ];
    if let Some(origin) = origin.filter(|origin| is_allowed_browser_origin(origin)) {
        headers.push(Header::from_bytes("Access-Control-Allow-Origin", origin).unwrap());
        headers.push(Header::from_bytes("Vary", "Origin").unwrap());
        headers.push(Header::from_bytes("Access-Control-Allow-Private-Network", "true").unwrap());
    }
    headers
}

#[cfg(test)]
mod tests {
    use super::*;

    fn header_value(headers: &[Header], name: &str) -> Option<String> {
        headers
            .iter()
            .find(|header| header.field.as_str().to_string().eq_ignore_ascii_case(name))
            .map(|header| header.value.as_str().to_string())
    }

    #[test]
    fn allowed_browser_origins_are_narrowly_scoped() {
        for origin in [
            "chrome-extension://abc",
            "moz-extension://abc",
            "http://localhost",
            "http://localhost:19827",
            "http://127.0.0.1:5500",
            "http://[::1]:3000",
            "tauri://localhost",
            "http://tauri.localhost",
            "https://tauri.localhost",
        ] {
            assert!(is_allowed_browser_origin(origin), "{origin}");
        }

        for origin in [
            "",
            "HTTP://LOCALHOST",
            "http://localhost.evil.com",
            "http://127.0.0.1.evil.com",
            "https://localhost",
            "http://evil.com",
            "https://evil.com",
        ] {
            assert!(!is_allowed_browser_origin(origin), "{origin}");
        }
    }

    #[test]
    fn cors_headers_reflect_allowed_origin_only() {
        let allowed = local_cors_headers(Some("chrome-extension://abc"), "Content-Type");
        assert_eq!(
            header_value(&allowed, "Access-Control-Allow-Origin").as_deref(),
            Some("chrome-extension://abc")
        );
        assert_eq!(
            header_value(&allowed, "Access-Control-Allow-Private-Network").as_deref(),
            Some("true")
        );
        assert_eq!(
            header_value(&allowed, "Access-Control-Allow-Methods").as_deref(),
            Some("GET, POST, PATCH, OPTIONS")
        );
        assert_eq!(
            header_value(&allowed, "Access-Control-Allow-Headers").as_deref(),
            Some("Content-Type")
        );
        assert_eq!(header_value(&allowed, "Vary").as_deref(), Some("Origin"));

        let denied = local_cors_headers(Some("https://evil.com"), "Content-Type");
        assert!(header_value(&denied, "Access-Control-Allow-Origin").is_none());
        assert!(header_value(&denied, "Access-Control-Allow-Private-Network").is_none());
        assert!(header_value(&denied, "Vary").is_none());

        let missing = local_cors_headers(None, "Content-Type");
        assert!(header_value(&missing, "Access-Control-Allow-Origin").is_none());
    }
}
