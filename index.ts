type BreakerOptions = {
  maxRetries?: number; // max number of times to retry a function before throwing an error
  tripAt?: number; // trip when this percentage of requests fail
  openAfter?: number; // open circuit after this
  retryAfter?: number; // retry function call after this duration
  functionToRun: () => Promise<any>;
};

const Circuitbreaker = (params: BreakerOptions) => {
  const maxRetries = params.maxRetries ?? 3;
  const tripAt = params.tripAt ?? 3;
  const openAfter = params.openAfter ?? 30000;
  let isTripped = false;
  let failedRequests = 0;
  let successFullRequests = 0;
  let lastTrippedTime = Date.now();

  const fire = async () => {
    if (isTripped) {
      if (Date.now() - lastTrippedTime > openAfter) {
        isTripped = false;
        return await fireWithRetries();
      } else {
        return Promise.reject(
          new Error("Circuit is tripped. Please try again later.")
        );
      }
    } else {
      return await fireWithRetries();
    }
  };

  const fireWithRetries = async () => {
    let attempts = 1;
    console.log(`attempt ${attempts}`);
    while (attempts <= maxRetries) {
      try {
        const res = await params.functionToRun();
        successFullRequests++;
        console.log(res.status);
        return;
      } catch (err) {
        failedRequests++;
        const totalRequests = successFullRequests + failedRequests;
        const failedPercentage = (failedRequests / totalRequests) * 100;
        console.log(
          `attempts: ${attempts} failedPercentage: ${failedPercentage}`
        );
        if (failedPercentage >= tripAt && attempts > maxRetries) {
          isTripped = true;
          lastTrippedTime = Date.now();
          return Promise.reject(
            new Error("Circuit is tripped due to high failure rate.")
          );
        }
        attempts++;
        await new Promise((resolve) =>
          setTimeout(resolve, params.retryAfter ?? 3000)
        );
      }
    }
    return Promise.reject(new Error("Max retries exceeded."));
  };

  return { fire };
};

const fn = () => {
  return new Promise((resolve, reject) => {
    fetch("https://jsonplaceholder.typicode.com/todos/1")
      .then((res) => {
        resolve(res);
      })
      .catch((err) => {
        reject(err);
      });
  });
};

const errFn = () => {
  return new Promise((resolve, reject) => {
    fetch("invalid url")
      .then((res) => {
        resolve(res);
      })
      .catch((err) => {
        reject(err);
      });
  });
};

const options: BreakerOptions = {
  maxRetries: 3,
  tripAt: 3,
  openAfter: 30000,
  functionToRun: errFn,
};

Circuitbreaker(options).fire();
