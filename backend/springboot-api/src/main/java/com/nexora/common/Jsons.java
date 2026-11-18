package com.nexora.common;

import java.util.LinkedHashMap;
import java.util.Map;

public final class Jsons {
    private Jsons() {
    }

    /** Small helper to build ordered JSON-ish maps: Jsons.map("a", 1, "b", "x"). Null values are skipped. */
    public static Map<String, Object> map(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) {
            if (kv[i + 1] != null) {
                m.put(String.valueOf(kv[i]), kv[i + 1]);
            }
        }
        return m;
    }
}
