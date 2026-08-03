#include "WeWorkFinanceSdk_C.h"

#include <cstdlib>
#include <iostream>
#include <string>

namespace {

const char* required_env(const char* name) {
  const char* value = std::getenv(name);
  if (value == nullptr || value[0] == '\0') {
    std::cerr << "missing environment variable: " << name << '\n';
    std::exit(2);
  }
  return value;
}

unsigned long long parse_number(const char* value, const char* name) {
  char* end = nullptr;
  const auto result = std::strtoull(value, &end, 10);
  if (end == value || *end != '\0') {
    std::cerr << "invalid " << name << ": " << value << '\n';
    std::exit(2);
  }
  return result;
}

}  // namespace

int main(int argc, char** argv) {
  if (argc < 2) {
    std::cerr << "usage: wecom-finance-cli fetch <seq> <limit> | decrypt <key> <message> | media <sdkfileid>\n";
    return 2;
  }

  const std::string action(argv[1]);
  if (action == "decrypt") {
    if (argc != 4) return 2;
    Slice_t* output = NewSlice();
    const int result = DecryptData(argv[2], argv[3], output);
    if (result == 0 && output != nullptr && output->buf != nullptr) {
      std::cout.write(output->buf, output->len);
    } else {
      std::cerr << "DecryptData failed: " << result << '\n';
    }
    FreeSlice(output);
    return result;
  }

  if (action != "fetch" && action != "media") return 2;
  if (action == "fetch" && argc != 4) return 2;
  if (action == "media" && argc != 3) return 2;

  WeWorkFinanceSdk_t* sdk = NewSdk();
  if (sdk == nullptr) {
    std::cerr << "NewSdk failed\n";
    return 3;
  }

  int result = Init(sdk, required_env("WECOM_CORP_ID"), required_env("WECOM_ARCHIVE_SECRET"));
  if (result != 0) {
    std::cerr << "Init failed: " << result << '\n';
    DestroySdk(sdk);
    return result;
  }

  if (action == "media") {
    if (argc != 3) {
      DestroySdk(sdk);
      return 2;
    }
    std::string index;
    int is_finish = 0;
    while (is_finish == 0) {
      MediaData_t* media = NewMediaData();
      result = GetMediaData(sdk, index.c_str(), argv[2], "", "", 10, media);
      if (result != 0) {
        std::cerr << "GetMediaData failed: " << result << '\n';
        FreeMediaData(media);
        DestroySdk(sdk);
        return result;
      }
      if (media->data != nullptr && media->data_len > 0) {
        std::cout.write(media->data, media->data_len);
      }
      index.assign(media->outindexbuf == nullptr ? "" : media->outindexbuf,
                   media->outindexbuf == nullptr ? 0 : media->out_len);
      is_finish = media->is_finish;
      FreeMediaData(media);
    }
    DestroySdk(sdk);
    return 0;
  }

  Slice_t* output = NewSlice();
  result = GetChatData(
      sdk,
      parse_number(argv[2], "seq"),
      static_cast<unsigned int>(parse_number(argv[3], "limit")),
      "",
      "",
      10,
      output);

  if (result == 0 && output != nullptr && output->buf != nullptr) {
    std::cout.write(output->buf, output->len);
  } else {
    std::cerr << "GetChatData failed: " << result << '\n';
  }

  FreeSlice(output);
  DestroySdk(sdk);
  return result;
}
